from datetime import datetime, timezone
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.db import supabase
from app.deps import UserProfile, get_current_user, require_admin, require_technician_or_admin
from app.services.audit import log_action
from app.services.rfid_utils import normalize_rfid
from app.services.serializers import serialize_asset
from app.services.storage import ASSET_BUCKET, delete_file, get_signed_url, upload_asset_image

router = APIRouter()


def _assert_asset_exists(rfid: str) -> dict:
    res = supabase.table("assets").select("*").eq("rfid_uid", rfid).limit(1).execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Asset not found"}})
    return res.data[0]


@router.get("")
def list_assets(
    include_archived: bool = False,
    q: Optional[str] = None,
    status: Optional[str] = None,
    criticality: Optional[int] = None,
    user: UserProfile = Depends(get_current_user),
):
    query = supabase.table("assets").select("*")
    if not include_archived or user.role == "customer":
        query = query.is_("archived_at", "null")
    if status:
        query = query.eq("status", status)
    if criticality is not None:
        query = query.eq("criticality", criticality)
    res = query.order("name").execute()
    assets = res.data or []
    if q:
        q_lower = q.strip().lower()
        assets = [
            a
            for a in assets
            if q_lower in a.get("name", "").lower()
            or q_lower in a.get("rfid_uid", "").lower()
            or q_lower in (a.get("location") or "").lower()
            or q_lower in (a.get("model") or "").lower()
        ]
    return [serialize_asset(a, include_images=False) for a in assets]


@router.get("/lookup")
def lookup_asset(rfid: str, user: UserProfile = Depends(get_current_user)):
    rfid = normalize_rfid(rfid)
    res = supabase.table("assets").select("*").eq("rfid_uid", rfid).limit(1).execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Asset not found"}})
    asset = res.data[0]
    if asset.get("archived_at"):
        raise HTTPException(404, detail={"error": {"code": "archived_asset", "message": "Asset is archived"}})
    return serialize_asset(asset, include_images=False)


@router.get("/{rfid}")
def get_asset(rfid: str, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    return serialize_asset(asset, include_images=True)


class AssetCreate(BaseModel):
    rfid_uid: str
    name: str
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    criticality: int = 3
    status: str = "active"
    install_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    last_service_date: Optional[str] = None
    next_service_due: Optional[str] = None
    notes: Optional[str] = None
    specs: Optional[dict] = None


@router.post("", status_code=201)
def create_asset(body: AssetCreate, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(body.rfid_uid)
    existing = supabase.table("assets").select("rfid_uid").eq("rfid_uid", rfid).execute()
    if existing.data:
        raise HTTPException(
            409, detail={"error": {"code": "duplicate_rfid", "message": "An asset with this RFID already exists"}}
        )

    data = body.model_dump()
    data["rfid_uid"] = rfid
    data["created_by"] = user.id
    if data.get("specs") is None:
        data["specs"] = {}
    res = supabase.table("assets").insert(data).execute()
    if user.role == "admin":
        log_action(user, "device.created", "device", rfid, {"name": body.name})
    return serialize_asset(res.data[0], include_images=False)


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    location: Optional[str] = None
    criticality: Optional[int] = None
    status: Optional[str] = None
    install_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    last_service_date: Optional[str] = None
    next_service_due: Optional[str] = None
    notes: Optional[str] = None
    specs: Optional[dict] = None


@router.patch("/{rfid}")
def update_asset(rfid: str, body: AssetUpdate, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    _assert_asset_exists(rfid)
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(400, detail={"error": {"code": "validation_error", "message": "No fields to update"}})
    res = supabase.table("assets").update(data).eq("rfid_uid", rfid).execute()
    if user.role == "admin":
        log_action(user, "device.updated", "device", rfid, {"fields": list(data.keys())})
    return serialize_asset(res.data[0], include_images=True)


@router.post("/{rfid}/images", status_code=201)
def upload_asset_image_endpoint(
    rfid: str,
    file: UploadFile = File(...),
    user: UserProfile = Depends(require_technician_or_admin),
):
    rfid = normalize_rfid(rfid)
    _assert_asset_exists(rfid)
    count_res = supabase.table("asset_images").select("id").eq("asset_rfid", rfid).execute()
    if len(count_res.data or []) >= 3:
        raise HTTPException(409, detail={"error": {"code": "too_many_images", "message": "Maximum 3 images per asset"}})
    image_uuid = str(uuid.uuid4())
    path = upload_asset_image(image_uuid.replace("-", ""), file)
    res = (
        supabase.table("asset_images")
        .insert({"id": image_uuid, "asset_rfid": rfid, "storage_path": path, "uploaded_by": user.id})
        .execute()
    )
    row = res.data[0]
    return {
        "id": row["id"],
        "asset_rfid": rfid,
        "url": get_signed_url(ASSET_BUCKET, path),
        "storage_path": path,
        "uploaded_by": user.id,
        "uploaded_at": row.get("uploaded_at", datetime.now(timezone.utc).isoformat()),
    }


@router.delete("/{rfid}/images/{image_id}", status_code=204)
def delete_asset_image(rfid: str, image_id: str, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    img_res = supabase.table("asset_images").select("*").eq("id", image_id).eq("asset_rfid", rfid).limit(1).execute()
    if not img_res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Image not found"}})
    delete_file(ASSET_BUCKET, img_res.data[0]["storage_path"])
    supabase.table("asset_images").delete().eq("id", image_id).execute()


@router.get("/{rfid}/history")
def asset_history(rfid: str, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    incidents = supabase.table("incidents").select("*").eq("asset_rfid", rfid).order("occurred_at", desc=True).execute()
    maint = supabase.table("maintenance_logs").select("*").eq("asset_rfid", rfid).order("performed_at", desc=True).execute()

    history: list[dict] = []
    for i in incidents.data or []:
        ts = i.get("resolved_at") or i.get("occurred_at") or i.get("created_at") or ""
        history.append({"kind": "incident", "id": i["id"], "timestamp": ts, "data": i})
    for m in maint.data or []:
        ts = m.get("performed_at") or m.get("created_at") or ""
        history.append({"kind": "maintenance", "id": m["id"], "timestamp": ts, "data": m})
    history.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return history


class MaintenanceCreate(BaseModel):
    type: str = "preventive"
    report: Optional[str] = None
    parts_replaced: list = []
    performed_at: Optional[str] = None
    next_due_date: Optional[str] = None


@router.post("/{rfid}/maintenance", status_code=201)
def add_maintenance(rfid: str, body: MaintenanceCreate, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    _assert_asset_exists(rfid)
    performed_at = body.performed_at or datetime.now(timezone.utc).isoformat()
    res = (
        supabase.table("maintenance_logs")
        .insert(
            {
                "asset_rfid": rfid,
                "type": body.type,
                "report": body.report or "",
                "parts_replaced": body.parts_replaced,
                "performed_by": user.id,
                "performed_at": performed_at,
                "next_due_date": body.next_due_date,
            }
        )
        .execute()
    )
    row = res.data[0]
    row["performed_by_name"] = user.full_name
    return row


@router.post("/{rfid}/archive", status_code=200)
def archive_asset(rfid: str, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    if asset.get("archived_at"):
        raise HTTPException(409, detail={"error": {"code": "validation_error", "message": "Asset is already archived"}})
    res = (
        supabase.table("assets")
        .update({"archived_at": datetime.now(timezone.utc).isoformat(), "archived_by": user.id})
        .eq("rfid_uid", rfid)
        .execute()
    )
    log_action(user, "device.archived", "device", rfid, {"name": asset["name"]})
    return serialize_asset(res.data[0], include_images=True)


@router.post("/{rfid}/restore", status_code=200)
def restore_asset(rfid: str, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    res = supabase.table("assets").update({"archived_at": None, "archived_by": None}).eq("rfid_uid", rfid).execute()
    log_action(user, "device.restored", "device", rfid, {"name": asset["name"]})
    return serialize_asset(res.data[0], include_images=True)


class RekeyBody(BaseModel):
    new_rfid_uid: Optional[str] = None
    new_rfid: Optional[str] = None


@router.post("/{rfid}/rekey", status_code=200)
def rekey_asset(rfid: str, body: RekeyBody, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    raw_new = body.new_rfid_uid or body.new_rfid
    if not raw_new:
        raise HTTPException(400, detail={"error": {"code": "validation_error", "message": "new_rfid_uid is required"}})
    new_rfid = normalize_rfid(raw_new)
    _assert_asset_exists(rfid)
    existing = supabase.table("assets").select("rfid_uid").eq("rfid_uid", new_rfid).execute()
    if existing.data:
        raise HTTPException(409, detail={"error": {"code": "duplicate_rfid", "message": "New RFID is already in use"}})
    res = supabase.table("assets").update({"rfid_uid": new_rfid}).eq("rfid_uid", rfid).execute()
    log_action(user, "device.rekeyed", "device", new_rfid, {"old_rfid": rfid, "new_rfid": new_rfid})
    return serialize_asset(res.data[0], include_images=True)


@router.delete("/{rfid}", status_code=204)
def delete_asset(rfid: str, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    for table, col in [("tickets", "asset_rfid"), ("incidents", "asset_rfid"), ("maintenance_logs", "asset_rfid")]:
        res = supabase.table(table).select("id").eq(col, rfid).limit(1).execute()
        if res.data:
            raise HTTPException(
                409,
                detail={"error": {"code": "has_linked_records", "message": f"Asset has linked {table}. Archive it instead."}},
            )
    img_res = supabase.table("asset_images").select("storage_path").eq("asset_rfid", rfid).execute()
    for img in img_res.data or []:
        delete_file(ASSET_BUCKET, img["storage_path"])
    supabase.table("assets").delete().eq("rfid_uid", rfid).execute()
    log_action(user, "device.deleted", "device", rfid, {"name": asset["name"]})
