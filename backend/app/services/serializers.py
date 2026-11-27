"""Shared serializers that format DB rows into the exact JSON shapes expected by the React client."""
from datetime import datetime, timezone
from app.db import supabase
from app.services.priority import compute_effective_priority
from app.services.storage import ASSET_BUCKET, TICKET_BUCKET, get_signed_url


def format_ticket_number(ticket_id: str) -> str:
    return f"TKT-{ticket_id.replace('-', '')[:6].upper()}"


def serialize_asset(asset: dict, include_images: bool = True) -> dict:
    rfid = asset["rfid_uid"]
    images: list[dict] = []
    if include_images:
        imgs = supabase.table("asset_images").select("*").eq("asset_rfid", rfid).execute()
        for i in imgs.data or []:
            images.append(
                {
                    "id": i["id"],
                    "asset_rfid": i["asset_rfid"],
                    "url": get_signed_url(ASSET_BUCKET, i["storage_path"]),
                    "storage_path": i["storage_path"],
                    "uploaded_by": i.get("uploaded_by"),
                    "uploaded_at": i.get("uploaded_at", ""),
                }
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
        "archived_by": asset.get("archived_by"),
        "images": images,
    }


def serialize_ticket(
    ticket: dict,
    include_images: bool = True,
    include_history: bool = False,
) -> dict:
    ticket_id = ticket["id"]
    rfid = ticket["asset_rfid"]

    # Asset summary
    asset_res = (
        supabase.table("assets")
        .select("rfid_uid,name,location,model,criticality")
        .eq("rfid_uid", rfid)
        .limit(1)
        .execute()
    )
    asset = (asset_res.data or [{}])[0]

    # Raiser name
    raiser_res = (
        supabase.table("profiles")
        .select("full_name")
        .eq("id", ticket["raised_by"])
        .limit(1)
        .execute()
    )
    raiser_name = ((raiser_res.data or [{}])[0]).get("full_name") or "Unknown"

    # Images (signed URLs)
    image_urls: list[str] = []
    if include_images:
        img_res = (
            supabase.table("ticket_images")
            .select("storage_path")
            .eq("ticket_id", ticket_id)
            .execute()
        )
        image_urls = [
            get_signed_url(TICKET_BUCKET, r["storage_path"])
            for r in (img_res.data or [])
        ]

    # Effective priority
    created_str = ticket.get("created_at") or datetime.now(timezone.utc).isoformat()
    created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
    base_score = float(ticket.get("priority_score") or 50)
    effective_priority = round(
        compute_effective_priority(base_score, created_dt, ticket.get("priority_override")),
        2,
    )

    ai_status = ticket.get("ai_status") or "pending"
    severity = ticket.get("ai_severity") or "medium"
    safety_risk = bool(ticket.get("ai_safety_risk", False))
    ai_score = ticket.get("ai_score") if ticket.get("ai_score") is not None else 50
    crit = asset.get("criticality") or 3

    triage_mode = "fallback" if ai_status == "fallback" else "gemini"
    factors = [
        {"label": f"AI Severity Score ({ai_score}/100 × 60%)", "points": round(0.6 * ai_score, 1)},
        {"label": f"Asset Criticality ({crit}/5 × 6)", "points": crit * 6},
    ]
    if safety_risk:
        factors.append({"label": "Safety Risk Flag", "points": 25})

    resolution_obj = None
    if ticket.get("status") == "resolved":
        inc_res = (
            supabase.table("incidents")
            .select("root_cause,resolution,parts_replaced,resolved_at")
            .eq("ticket_id", ticket_id)
            .limit(1)
            .execute()
        )
        mlog_res = (
            supabase.table("maintenance_logs")
            .select("report")
            .eq("ticket_id", ticket_id)
            .limit(1)
            .execute()
        )
        inc = (inc_res.data or [{}])[0]
        mlog = (mlog_res.data or [{}])[0]
        resolver_name = None
        if ticket.get("resolved_by"):
            r_res = (
                supabase.table("profiles")
                .select("full_name")
                .eq("id", ticket["resolved_by"])
                .limit(1)
                .execute()
            )
            resolver_name = ((r_res.data or [{}])[0]).get("full_name")
        resolution_obj = {
            "root_cause": inc.get("root_cause") or "",
            "resolution": inc.get("resolution") or "",
            "parts_replaced": inc.get("parts_replaced") or [],
            "resolved_at": ticket.get("resolved_at") or inc.get("resolved_at") or "",
            "resolved_by_name": resolver_name,
            "report": mlog.get("report") or "",
        }

    status_history = None
    if include_history:
        hist_res = (
            supabase.table("ticket_status_history")
            .select("*")
            .eq("ticket_id", ticket_id)
            .order("changed_at", desc=False)
            .execute()
        )
        status_history = hist_res.data or []

    return {
        "id": ticket_id,
        "ticket_number": format_ticket_number(ticket_id),
        "asset_rfid": rfid,
        "asset_name": asset.get("name") or rfid,
        "asset_location": asset.get("location") or "",
        "asset_model": asset.get("model"),
        "asset_criticality": crit,
        "raised_by": ticket["raised_by"],
        "raised_by_name": raiser_name,
        "workstation": None,
        "title": ticket["title"],
        "description": ticket["description"],
        "occurred_at": ticket["occurred_at"],
        "status": ticket["status"],
        "images": image_urls,
        "priority_score": effective_priority,
        "priority_override": ticket.get("priority_override"),
        "severity": severity,
        "triage": {
            "mode": triage_mode,
            "ai_status": ai_status,
            "severity": severity,
            "base_score": base_score,
            "safety_risk": safety_risk,
            "probable_cause": ticket.get("ai_probable_cause"),
            "summary": ticket.get("ai_summary"),
            "factors": factors,
        },
        "started_at": ticket.get("started_at"),
        "started_by": ticket.get("started_by"),
        "resolved_at": ticket.get("resolved_at"),
        "resolved_by": ticket.get("resolved_by"),
        "resolution": resolution_obj,
        "status_history": status_history,
        "created_at": created_str,
    }
