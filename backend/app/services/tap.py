import logging
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from app.db import supabase
from app.services.rfid_utils import normalize_rfid
from app.services.priority import compute_effective_priority
from app.services.storage import get_signed_url, TICKET_BUCKET, ASSET_BUCKET
from app.services.events import publish_tap

logger = logging.getLogger(__name__)

DEBOUNCE_SECONDS = 3


def _is_duplicate(scanner_id: str, rfid: str) -> bool:
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=DEBOUNCE_SECONDS)).isoformat()
    res = supabase.table("rfid_events").select("id").eq("scanner_id", scanner_id).eq("rfid_uid", rfid).gte("tapped_at", cutoff).limit(1).execute()
    return bool(res.data)


def _log_event(scanner_id: str, rfid: str, action: str, ticket_id: str | None = None) -> None:
    supabase.table("rfid_events").insert({
        "scanner_id": scanner_id,
        "rfid_uid": rfid,
        "action": action,
        "ticket_id": ticket_id,
    }).execute()


def _signed_ticket_images(ticket_id: str) -> list[str]:
    res = supabase.table("ticket_images").select("storage_path").eq("ticket_id", ticket_id).execute()
    return [get_signed_url(TICKET_BUCKET, r["storage_path"]) for r in (res.data or [])]


def _signed_asset_images(rfid: str) -> list[str]:
    res = supabase.table("asset_images").select("storage_path").eq("asset_rfid", rfid).execute()
    return [get_signed_url(ASSET_BUCKET, r["storage_path"]) for r in (res.data or [])]


def _build_ticket_dict(ticket: dict) -> dict:
    images = _signed_ticket_images(ticket["id"])
    created_dt = datetime.fromisoformat(ticket["created_at"].replace("Z", "+00:00"))
    effective = compute_effective_priority(
        ticket.get("priority_score") or 50,
        created_dt,
        ticket.get("priority_override"),
    )
    raised_by_res = supabase.table("profiles").select("full_name").eq("id", ticket["raised_by"]).single().execute()
    return {
        "id": ticket["id"],
        "title": ticket["title"],
        "description": ticket["description"],
        "occurred_at": ticket["occurred_at"],
        "status": ticket["status"],
        "raised_by": {"full_name": (raised_by_res.data or {}).get("full_name", "Unknown")},
        "images": images,
        "ai_severity": ticket.get("ai_severity"),
        "ai_score": ticket.get("ai_score"),
        "ai_summary": ticket.get("ai_summary"),
        "priority": round(effective, 2),
    }


def _build_asset_dict(asset: dict) -> dict:
    images = _signed_asset_images(asset["rfid_uid"])
    incidents = supabase.table("incidents").select("*").eq("asset_rfid", asset["rfid_uid"]).order("occurred_at", desc=True).limit(5).execute()
    maintenance = supabase.table("maintenance_logs").select("*").eq("asset_rfid", asset["rfid_uid"]).order("performed_at", desc=True).limit(5).execute()
    return {
        "rfid_uid": asset["rfid_uid"],
        "name": asset["name"],
        "model": asset.get("model"),
        "location": asset.get("location"),
        "criticality": asset.get("criticality"),
        "status": asset.get("status"),
        "install_date": str(asset.get("install_date", "")),
        "warranty_expiry": str(asset.get("warranty_expiry", "")),
        "last_service_date": str(asset.get("last_service_date", "")),
        "next_service_due": str(asset.get("next_service_due", "")),
        "images": images,
        "recent_incidents": incidents.data or [],
        "recent_maintenance": maintenance.data or [],
    }


def process_tap(scanner: dict, raw_rfid: str) -> dict:
    """
    Main tap handler. Returns the ESP response dict {"status": "ok", "mode": "..."}.
    Also builds and publishes the SSE payload.
    """
    rfid = normalize_rfid(raw_rfid)
    scanner_id = scanner["id"]
    scanner_code = scanner["scanner_code"]

    # Debounce
    if _is_duplicate(scanner_id, rfid):
        return {"status": "duplicate", "mode": "duplicate"}

    tapped_at = datetime.now(timezone.utc).isoformat()

    # 1. Unknown tag
    asset_res = supabase.table("assets").select("*").eq("rfid_uid", rfid).single().execute()
    if not asset_res.data:
        _log_event(scanner_id, rfid, "unknown_tag")
        payload = {"mode": "unknown_tag", "rfid_uid": rfid, "tapped_at": tapped_at, "scanner_code": scanner_code}
        publish_tap(payload)
        return {"status": "ok", "mode": "unknown_tag"}

    asset = asset_res.data

    # 2. Archived tag
    if asset.get("archived_at"):
        _log_event(scanner_id, rfid, "archived_tag")
        payload = {"mode": "archived_tag", "rfid_uid": rfid, "tapped_at": tapped_at, "scanner_code": scanner_code,
                   "device_name": asset["name"], "archived_at": asset["archived_at"]}
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
        # Sort by effective priority
        def eff(t):
            created_dt = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
            return compute_effective_priority(t.get("priority_score") or 50, created_dt, t.get("priority_override"))
        tickets_list.sort(key=eff, reverse=True)
        top = tickets_list[0]
        rest = tickets_list[1:]

        # Atomic conditional update (only if still pending_review)
        update_res = supabase.table("tickets").update({
            "status": "under_review",
            "started_at": tapped_at,
        }).eq("id", top["id"]).eq("status", "pending_review").execute()

        if not update_res.data:
            # Race condition: another tap won
            return {"status": "ok", "mode": "start"}

        # Write status history
        supabase.table("ticket_status_history").insert({
            "ticket_id": top["id"],
            "from_status": "pending_review",
            "to_status": "under_review",
            "changed_by": None,
            "via": "tap",
        }).execute()

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
