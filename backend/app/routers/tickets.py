from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import Optional, List
from pydantic import BaseModel
from app.deps import get_current_user, require_technician_or_admin, UserProfile
from app.db import supabase
from app.services.rfid_utils import normalize_rfid
from app.services.storage import upload_ticket_image, get_signed_url, delete_file, TICKET_BUCKET
from app.services.priority import compute_effective_priority
from app.services.gemini import analyze_ticket
import uuid
from datetime import datetime, timezone

router = APIRouter()


def _get_effective_priority(ticket: dict) -> float:
    created_dt = datetime.fromisoformat(ticket["created_at"].replace("Z", "+00:00"))
    return compute_effective_priority(ticket.get("priority_score") or 50, created_dt, ticket.get("priority_override"))


# POST /tickets (customer)
@router.post("", status_code=201)
def create_ticket(
    background_tasks: BackgroundTasks,
    asset_rfid: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    occurred_at: str = Form(...),
    images: List[UploadFile] = File(default=[]),
    user: UserProfile = Depends(get_current_user),
):
    if user.role != "customer":
        raise HTTPException(403, detail={"error": {"code": "forbidden", "message": "Only customers can raise tickets"}})

    rfid = normalize_rfid(asset_rfid)

    # Validate asset
    asset_res = supabase.table("assets").select("*").eq("rfid_uid", rfid).single().execute()
    if not asset_res.data:
        raise HTTPException(404, detail={"error": {"code": "unknown_asset", "message": "Asset not found"}})
    if asset_res.data.get("archived_at"):
        raise HTTPException(409, detail={"error": {"code": "archived_asset", "message": "Cannot raise ticket on an archived asset"}})
    asset = asset_res.data

    # Validate images
    if len(images) > 2:
        raise HTTPException(409, detail={"error": {"code": "too_many_images", "message": "Maximum 2 images per ticket"}})

    # Create ticket
    ticket_id = str(uuid.uuid4())
    ticket_data = {
        "id": ticket_id,
        "asset_rfid": rfid,
        "raised_by": user.id,
        "title": title,
        "description": description,
        "occurred_at": occurred_at,
        "status": "pending_review",
        "ai_status": "pending",
    }
    supabase.table("tickets").insert(ticket_data).execute()

    # Status history
    supabase.table("ticket_status_history").insert({
        "ticket_id": ticket_id,
        "from_status": None,
        "to_status": "pending_review",
        "changed_by": user.id,
        "via": "form",
    }).execute()

    # Upload images
    for img_file in images:
        if img_file.filename:
            path = upload_ticket_image(ticket_id, img_file)
            supabase.table("ticket_images").insert({"ticket_id": ticket_id, "storage_path": path}).execute()

    # Fire AI analysis in background
    incidents_res = supabase.table("incidents").select("summary,root_cause,resolution").eq("asset_rfid", rfid).order("occurred_at", desc=True).limit(5).execute()
    background_tasks.add_task(analyze_ticket, ticket_id, description, asset, incidents_res.data or [], [])

    return {"id": ticket_id, "status": "pending_review", "ai_status": "pending", "created_at": "now()"}


# GET /tickets
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
        # Sort by effective priority desc
        tickets.sort(key=_get_effective_priority, reverse=True)
    return tickets


# GET /tickets/{id}
@router.get("/{ticket_id}")
def get_ticket(ticket_id: str, user: UserProfile = Depends(get_current_user)):
    res = supabase.table("tickets").select("*").eq("id", ticket_id).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Ticket not found"}})
    ticket = res.data
    if user.role == "customer" and ticket["raised_by"] != user.id:
        raise HTTPException(403, detail={"error": {"code": "forbidden", "message": "Access denied"}})
    # Signed image URLs
    imgs = supabase.table("ticket_images").select("*").eq("ticket_id", ticket_id).execute()
    ticket["images"] = [{"id": i["id"], "url": get_signed_url(TICKET_BUCKET, i["storage_path"])} for i in (imgs.data or [])]
    return ticket


# PATCH /tickets/{id}/priority (technician or admin)
class PriorityOverride(BaseModel):
    override: Optional[float] = None  # None to clear

@router.patch("/{ticket_id}/priority")
def set_priority_override(ticket_id: str, body: PriorityOverride, user: UserProfile = Depends(require_technician_or_admin)):
    res = supabase.table("tickets").select("id,status").eq("id", ticket_id).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Ticket not found"}})
    supabase.table("tickets").update({"priority_override": body.override}).eq("id", ticket_id).execute()
    return {"priority_override": body.override}


# POST /tickets/{id}/resolve (technician or admin, calls the atomic DB function)
class ResolveBody(BaseModel):
    root_cause: str
    resolution: str
    parts_replaced: list = []
    report: Optional[str] = None
    asset_updates: Optional[dict] = None

@router.post("/{ticket_id}/resolve")
def resolve_ticket(ticket_id: str, body: ResolveBody, user: UserProfile = Depends(require_technician_or_admin)):
    asset_updates = body.asset_updates or {}
    try:
        result = supabase.rpc("resolve_ticket", {
            "p_ticket_id": ticket_id,
            "p_resolved_by": user.id,
            "p_root_cause": body.root_cause,
            "p_resolution": body.resolution,
            "p_parts_replaced": body.parts_replaced,
            "p_report": body.report or "",
            "p_asset_status": asset_updates.get("status", ""),
            "p_next_service_due": asset_updates.get("next_service_due"),
            "p_notes": asset_updates.get("notes", ""),
        }).execute()
    except Exception as e:
        err = str(e)
        if "invalid_transition" in err:
            raise HTTPException(409, detail={"error": {"code": "invalid_transition", "message": "Ticket must be under_review to resolve"}})
        if "not_found" in err:
            raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Ticket not found"}})
        raise HTTPException(500, detail={"error": {"code": "error", "message": str(e)}})
    return result.data
