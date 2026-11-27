import logging
from datetime import datetime, timedelta, timezone

from app.db import supabase
from app.services.events import publish_tap
from app.services.priority import compute_effective_priority
from app.services.rfid_utils import normalize_rfid
from app.services.serializers import format_ticket_number
from app.services.storage import ASSET_BUCKET, TICKET_BUCKET, get_signed_url

logger = logging.getLogger(__name__)

DEBOUNCE_SECONDS = 3


def _is_duplicate(scanner_id: str, rfid: str) -> bool:
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=DEBOUNCE_SECONDS)).isoformat()
    res = (
        supabase.table("rfid_events")
        .select("id")
        .eq("scanner_id", scanner_id)
        .eq("rfid_uid", rfid)
        .gte("tapped_at", cutoff)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _log_event(scanner_id: str, rfid: str, action: str, ticket_id: str | None = None) -> None:
    supabase.table("rfid_events").insert(
        {
            "scanner_id": scanner_id,
            "rfid_uid": rfid,
            "action": action,
            "ticket_id": ticket_id,
        }
    ).execute()


def _signed_ticket_images(ticket_id: str) -> list[str]:
    res = supabase.table("ticket_images").select("storage_path").eq("ticket_id", ticket_id).execute()
    return [get_signed_url(TICKET_BUCKET, r["storage_path"]) for r in (res.data or [])]


def _signed_asset_images(rfid: str) -> list[str]:
    res = supabase.table("asset_images").select("storage_path").eq("asset_rfid", rfid).execute()
    return [get_signed_url(ASSET_BUCKET, r["storage_path"]) for r in (res.data or [])]


def _build_ticket_dict(ticket: dict) -> dict:
    images = _signed_ticket_images(ticket["id"])
    created_dt = datetime.fromisoformat(ticket["created_at"].replace("Z", "+00:00"))
    base_score = float(ticket.get("priority_score") or 50)
    effective = round(
        compute_effective_priority(base_score, created_dt, ticket.get("priority_override")),
        2,
    )
    raised_by_res = (
        supabase.table("profiles").select("full_name").eq("id", ticket["raised_by"]).limit(1).execute()
    )
    raised_name = ((raised_by_res.data or [{}])[0]).get("full_name") or "Unknown"
    ai_status = ticket.get("ai_status") or "pending"
    severity = ticket.get("ai_severity") or "medium"
    safety_risk = bool(ticket.get("ai_safety_risk", False))

    return {
        "id": ticket["id"],
        "ticket_number": format_ticket_number(ticket["id"]),
        "title": ticket["title"],
        "description": ticket["description"],
        "occurred_at": ticket["occurred_at"],
        "created_at": ticket["created_at"],
        "status": ticket["status"],
        "raised_by": {"full_name": raised_name},
        "images": images,
        "severity": severity,
        "priority_score": effective,
        "priority_override": ticket.get("priority_override"),
        "priority": effective,
        "ai_severity": severity,
        "ai_score": ticket.get("ai_score"),
        "ai_summary": ticket.get("ai_summary"),
        "triage": {
            "mode": "fallback" if ai_status == "fallback" else "gemini",
            "ai_status": ai_status,
            "severity": severity,
            "base_score": base_score,
            "safety_risk": safety_risk,
            "probable_cause": ticket.get("ai_probable_cause"),
            "summary": ticket.get("ai_summary"),
            "factors": [],
        },
    }


def _build_asset_dict(asset: dict) -> dict:
    rfid = asset["rfid_uid"]
    images = _signed_asset_images(rfid)
    incidents = (
        supabase.table("incidents").select("*").eq("asset_rfid", rfid).order("occurred_at", desc=True).limit(5).execute()
    )
    maintenance = (
        supabase.table("maintenance_logs")
        .select("*")
        .eq("asset_rfid", rfid)
        .order("performed_at", desc=True)
        .limit(5)
        .execute()
    )
    return {
        "rfid_uid": rfid,
        "name": asset["name"],
        "model": asset.get("model") or "",
        "serial_no": asset.get("serial_no") or "",
        "location": asset.get("location") or "",
        "criticality": asset.get("criticality", 3),
        "status": asset.get("status", "active"),
        "install_date": asset.get("install_date"),
        "warranty_expiry": asset.get("warranty_expiry"),
        "last_service_date": asset.get("last_service_date"),
        "next_service_due": asset.get("next_service_due"),
        "notes": asset.get("notes"),
        "specs": asset.get("specs") or {},
        "archived_at": asset.get("archived_at"),
        "images": images,
        "recent_incidents": incidents.data or [],
        "recent_maintenance": maintenance.data or [],
    }


def process_tap(scanner: dict, raw_rfid: str) -> dict:
    """Main tap handler. Returns ESP response dict and publishes SSE payload."""
    rfid = normalize_rfid(raw_rfid)
    scanner_id = scanner["id"]
    scanner_code = scanner["scanner_code"]

    if _is_duplicate(scanner_id, rfid):
        return {"status": "duplicate", "mode": "duplicate"}

    tapped_at = datetime.now(timezone.utc).isoformat()

    # 1. Unknown tag
    asset_res = supabase.table("assets").select("*").eq("rfid_uid", rfid).limit(1).execute()
    if not asset_res.data:
        _log_event(scanner_id, rfid, "unknown_tag")
        payload = {"mode": "unknown_tag", "rfid_uid": rfid, "tapped_at": tapped_at, "scanner_code": scanner_code}
        publish_tap(payload)
        return {"status": "ok", "mode": "unknown_tag"}

    asset = asset_res.data[0]

    # 2. Archived tag
    if asset.get("archived_at"):
        _log_event(scanner_id, rfid, "archived_tag")
        payload = {
            "mode": "archived_tag",
            "rfid_uid": rfid,
            "tapped_at": tapped_at,
            "scanner_code": scanner_code,
            "asset": _build_asset_dict(asset),
        }
        publish_tap(payload)
        return {"status": "ok", "mode": "archived_tag"}

    # 3. Under review ticket?
    ur_res = supabase.table("tickets").select("*").eq("asset_rfid", rfid).eq("status", "under_review").limit(1).execute()
    if ur_res.data:
        ticket = ur_res.data[0]
        _log_event(scanner_id, rfid, "closeout_opened", ticket["id"])
        payload = {
            "mode": "closeout",
            "rfid_uid": rfid,
            "tapped_at": tapped_at,
            "scanner_code": scanner_code,
            "ticket": _build_ticket_dict(ticket),
            "other_open_tickets": [],
            "asset": _build_asset_dict(asset),
        }
        publish_tap(payload)
        return {"status": "ok", "mode": "closeout"}

    # 4. Pending review tickets?
    pr_res = supabase.table("tickets").select("*").eq("asset_rfid", rfid).eq("status", "pending_review").execute()
    if pr_res.data:
        tickets_list = pr_res.data

        def eff(t):
            created_dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
            return compute_effective_priority(t.get("priority_score") or 50, created_dt, t.get("priority_override"))

        tickets_list.sort(key=eff, reverse=True)
        top = tickets_list[0]
        rest = tickets_list[1:]

        update_res = (
            supabase.table("tickets")
            .update({"status": "under_review", "started_at": tapped_at})
            .eq("id", top["id"])
            .eq("status", "pending_review")
            .execute()
        )
        if not update_res.data:
            return {"status": "ok", "mode": "start"}

        supabase.table("ticket_status_history").insert(
            {
                "ticket_id": top["id"],
                "from_status": "pending_review",
                "to_status": "under_review",
                "changed_by": None,
                "via": "tap",
            }
        ).execute()

        top["status"] = "under_review"
        top["started_at"] = tapped_at

        _log_event(scanner_id, rfid, "started", top["id"])
        payload = {
            "mode": "start",
            "rfid_uid": rfid,
            "tapped_at": tapped_at,
            "scanner_code": scanner_code,
            "ticket": _build_ticket_dict(top),
            "other_open_tickets": [_build_ticket_dict(t) for t in rest[:3]],
            "asset": _build_asset_dict(asset),
        }
        publish_tap(payload)
        return {"status": "ok", "mode": "start"}

    # 5. Asset only
    _log_event(scanner_id, rfid, "asset_viewed")
    payload = {
        "mode": "asset_only",
        "rfid_uid": rfid,
        "tapped_at": tapped_at,
        "scanner_code": scanner_code,
        "ticket": None,
        "other_open_tickets": [],
        "asset": _build_asset_dict(asset),
    }
    publish_tap(payload)
    return {"status": "ok", "mode": "asset_only"}
