from datetime import datetime, timezone
import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.db import supabase
from app.deps import UserProfile, get_current_user, require_technician_or_admin
from app.services.gemini import analyze_ticket
from app.services.priority import compute_effective_priority
from app.services.rfid_utils import normalize_rfid
from app.services.serializers import serialize_ticket
from app.services.storage import upload_ticket_image

router = APIRouter()


def _get_effective_priority(ticket: dict) -> float:
    created_dt = datetime.fromisoformat(ticket["created_at"].replace("Z", "+00:00"))
    return compute_effective_priority(ticket.get("priority_score") or 50, created_dt, ticket.get("priority_override"))


@router.post("", status_code=201)
def create_ticket(
    background_tasks: BackgroundTasks,
    asset_rfid: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    occurred_at: str = Form(...),
    workstation: Optional[str] = Form(default=None),
    images: List[UploadFile] = File(default=[]),
    user: UserProfile = Depends(get_current_user),
):
    if user.role != "customer":
        raise HTTPException(403, detail={"error": {"code": "forbidden", "message": "Only customers can raise tickets"}})

    rfid = normalize_rfid(asset_rfid)
    asset_res = supabase.table("assets").select("*").eq("rfid_uid", rfid).limit(1).execute()
    if not asset_res.data:
        raise HTTPException(404, detail={"error": {"code": "unknown_asset", "message": "Asset not found"}})
    asset = asset_res.data[0]
    if asset.get("archived_at"):
        raise HTTPException(409, detail={"error": {"code": "archived_asset", "message": "Cannot raise ticket on an archived asset"}})

    real_images = [f for f in images if f.filename]
    if len(real_images) > 2:
        raise HTTPException(409, detail={"error": {"code": "too_many_images", "message": "Maximum 2 images per ticket"}})

    ticket_id = str(uuid.uuid4())
    full_description = f"[Workstation: {workstation.strip()}]\n{description}" if workstation and workstation.strip() else description
    now_iso = datetime.now(timezone.utc).isoformat()
    ticket_data = {
        "id": ticket_id,
        "asset_rfid": rfid,
        "raised_by": user.id,
        "title": title,
        "description": full_description,
        "occurred_at": occurred_at,
        "status": "pending_review",
        "ai_status": "pending",
        "created_at": now_iso,
    }
    res = supabase.table("tickets").insert(ticket_data).execute()
    created_row = res.data[0]

    supabase.table("ticket_status_history").insert(
        {
            "ticket_id": ticket_id,
            "from_status": None,
            "to_status": "pending_review",
            "changed_by": user.id,
            "via": "form",
        }
    ).execute()

    for img_file in real_images:
        path = upload_ticket_image(ticket_id, img_file)
        supabase.table("ticket_images").insert({"ticket_id": ticket_id, "storage_path": path}).execute()

    incidents_res = (
        supabase.table("incidents")
        .select("summary,root_cause,resolution")
        .eq("asset_rfid", rfid)
        .order("occurred_at", desc=True)
        .limit(5)
        .execute()
    )
    background_tasks.add_task(analyze_ticket, ticket_id, full_description, asset, incidents_res.data or [], [])

    serialized = serialize_ticket(created_row, include_images=True, include_history=False)
    if workstation and workstation.strip():
        serialized["workstation"] = workstation.strip()
    return serialized


@router.get("")
def list_tickets(status: Optional[str] = None, user: UserProfile = Depends(get_current_user)):
    if user.role == "customer":
        query = supabase.table("tickets").select("*").eq("raised_by", user.id)
    else:
        query = supabase.table("tickets").select("*")
    if status:
        query = query.eq("status", status)
    res = query.execute()
    tickets = res.data or []
    if user.role != "customer":
        tickets.sort(key=_get_effective_priority, reverse=True)
    else:
        tickets.sort(key=lambda t: t.get("created_at") or "", reverse=True)
    return [serialize_ticket(t, include_images=True, include_history=False) for t in tickets]


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str, user: UserProfile = Depends(get_current_user)):
    res = supabase.table("tickets").select("*").eq("id", ticket_id).limit(1).execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Ticket not found"}})
    ticket = res.data[0]
    if user.role == "customer" and ticket["raised_by"] != user.id:
        raise HTTPException(403, detail={"error": {"code": "forbidden", "message": "Access denied"}})
    return serialize_ticket(ticket, include_images=True, include_history=True)


class PriorityOverride(BaseModel):
    priority_override: Optional[float] = None
    override: Optional[float] = None


@router.patch("/{ticket_id}/priority")
def set_priority_override(
    ticket_id: str,
    body: PriorityOverride,
    user: UserProfile = Depends(require_technician_or_admin),
):
    res = supabase.table("tickets").select("*").eq("id", ticket_id).limit(1).execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Ticket not found"}})
    val = body.priority_override if body.priority_override is not None else body.override
    upd = supabase.table("tickets").update({"priority_override": val}).eq("id", ticket_id).execute()
    return serialize_ticket(upd.data[0], include_images=True, include_history=False)


class ResolveBody(BaseModel):
    root_cause: str
    resolution: str
    parts_replaced: list = []
    report: Optional[str] = None
    asset_updates: Optional[dict] = None


@router.post("/{ticket_id}/resolve")
def resolve_ticket(
    ticket_id: str,
    body: ResolveBody,
    user: UserProfile = Depends(require_technician_or_admin),
):
    asset_updates = body.asset_updates or {}
    try:
        supabase.rpc(
            "resolve_ticket",
            {
                "p_ticket_id": ticket_id,
                "p_resolved_by": user.id,
                "p_root_cause": body.root_cause,
                "p_resolution": body.resolution,
                "p_parts_replaced": body.parts_replaced,
                "p_report": body.report or "",
                "p_asset_status": asset_updates.get("status", ""),
                "p_next_service_due": asset_updates.get("next_service_due"),
                "p_notes": asset_updates.get("notes", ""),
            },
        ).execute()
    except Exception as e:
        err = str(e)
        if "invalid_transition" in err:
            raise HTTPException(
                409,
                detail={"error": {"code": "invalid_transition", "message": "Ticket must be under_review to resolve"}},
            )
        if "not_found" in err:
            raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Ticket not found"}})
        raise HTTPException(500, detail={"error": {"code": "error", "message": str(e)}})

    updated = supabase.table("tickets").select("*").eq("id", ticket_id).limit(1).execute()
    return serialize_ticket(updated.data[0], include_images=True, include_history=True)
