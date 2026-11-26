from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from typing import Optional
from pydantic import BaseModel
from app.deps import get_current_user, require_technician_or_admin, require_admin, UserProfile
from app.db import supabase
from app.services.rfid_utils import normalize_rfid
from app.services.storage import upload_asset_image, get_signed_url, delete_file, ASSET_BUCKET
from app.services.audit import log_action
import uuid

router = APIRouter()

# GET /assets - dropdown list (no archived)
@router.get("")
def list_assets(user: UserProfile = Depends(get_current_user)):
    res = supabase.table("assets").select("rfid_uid,name,model,location,status,criticality").is_("archived_at", "null").order("name").execute()
    return res.data or []

# GET /assets/lookup
@router.get("/lookup")
def lookup_asset(rfid: str, user: UserProfile = Depends(get_current_user)):
    rfid = normalize_rfid(rfid)
    res = supabase.table("assets").select("rfid_uid,name,model,status").eq("rfid_uid", rfid).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Asset not found"}})
    if res.data.get("archived_at"):
        raise HTTPException(404, detail={"error": {"code": "archived_asset", "message": "Asset is archived"}})
    return res.data

# GET /assets/{rfid} - full detail with signed image URLs
@router.get("/{rfid}")
def get_asset(rfid: str, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    res = supabase.table("assets").select("*").eq("rfid_uid", rfid).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Asset not found"}})
    asset = res.data
    imgs = supabase.table("asset_images").select("*").eq("asset_rfid", rfid).execute()
    asset["images"] = [{"id": i["id"], "url": get_signed_url(ASSET_BUCKET, i["storage_path"])} for i in (imgs.data or [])]
    return asset

# POST /assets - create
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
    # Check duplicate
    existing = supabase.table("assets").select("rfid_uid").eq("rfid_uid", rfid).execute()
    if existing.data:
        raise HTTPException(409, detail={"error": {"code": "duplicate_rfid", "message": "An asset with this RFID already exists"}})
    
    data = body.model_dump()
    data["rfid_uid"] = rfid
    data["created_by"] = user.id
    if data.get("specs") is None:
        data["specs"] = {}
    res = supabase.table("assets").insert(data).execute()
    return res.data[0]

# PATCH /assets/{rfid}
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

@router.patch("/{rfid}")
def update_asset(rfid: str, body: AssetUpdate, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    _assert_asset_exists(rfid)
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, detail={"error": {"code": "validation_error", "message": "No fields to update"}})
    res = supabase.table("assets").update(data).eq("rfid_uid", rfid).execute()
    return res.data[0]

# POST /assets/{rfid}/images
@router.post("/{rfid}/images", status_code=201)
def upload_asset_image_endpoint(rfid: str, file: UploadFile = File(...), user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    _assert_asset_exists(rfid)
    # Check max 3
    count_res = supabase.table("asset_images").select("id").eq("asset_rfid", rfid).execute()
    if len(count_res.data or []) >= 3:
        raise HTTPException(409, detail={"error": {"code": "too_many_images", "message": "Maximum 3 images per asset"}})
    image_id = uuid.uuid4().hex
    path = upload_asset_image(image_id, file)
    res = supabase.table("asset_images").insert({"id": str(uuid.uuid4()), "asset_rfid": rfid, "storage_path": path, "uploaded_by": user.id}).execute()
    return {"id": res.data[0]["id"], "storage_path": path}

# DELETE /assets/{rfid}/images/{image_id}
@router.delete("/{rfid}/images/{image_id}", status_code=204)
def delete_asset_image(rfid: str, image_id: str, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    img_res = supabase.table("asset_images").select("*").eq("id", image_id).eq("asset_rfid", rfid).single().execute()
    if not img_res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Image not found"}})
    delete_file(ASSET_BUCKET, img_res.data["storage_path"])
    supabase.table("asset_images").delete().eq("id", image_id).execute()

# GET /assets/{rfid}/history
@router.get("/{rfid}/history")
def asset_history(rfid: str, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    incidents = supabase.table("incidents").select("*").eq("asset_rfid", rfid).order("occurred_at", desc=True).execute()
    maint = supabase.table("maintenance_logs").select("*").eq("asset_rfid", rfid).order("performed_at", desc=True).execute()
    # Merge and sort by date
    history = []
    for i in (incidents.data or []):
        history.append({"type": "incident", "date": i.get("occurred_at"), **i})
    for m in (maint.data or []):
        history.append({"type": "maintenance", "date": m.get("performed_at"), **m})
    history.sort(key=lambda x: x.get("date") or "", reverse=True)
    return history

# POST /assets/{rfid}/maintenance
class MaintenanceCreate(BaseModel):
    type: str = "preventive"
    report: Optional[str] = None
    parts_replaced: list = []
    performed_at: str
    next_due_date: Optional[str] = None

@router.post("/{rfid}/maintenance", status_code=201)
def add_maintenance(rfid: str, body: MaintenanceCreate, user: UserProfile = Depends(require_technician_or_admin)):
    rfid = normalize_rfid(rfid)
    _assert_asset_exists(rfid)
    res = supabase.table("maintenance_logs").insert({
        "asset_rfid": rfid,
        "type": body.type,
        "report": body.report,
        "parts_replaced": body.parts_replaced,
        "performed_by": user.id,
        "performed_at": body.performed_at,
        "next_due_date": body.next_due_date,
    }).execute()
    return res.data[0]

# POST /assets/{rfid}/archive (admin)
@router.post("/{rfid}/archive", status_code=200)
def archive_asset(rfid: str, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    if asset.get("archived_at"):
        raise HTTPException(409, detail={"error": {"code": "validation_error", "message": "Asset is already archived"}})
    supabase.table("assets").update({"archived_at": "now()", "archived_by": user.id}).eq("rfid_uid", rfid).execute()
    log_action(user, "device.archived", "device", rfid, {"name": asset["name"]})
    return {"status": "archived"}

# POST /assets/{rfid}/restore (admin)
@router.post("/{rfid}/restore", status_code=200)
def restore_asset(rfid: str, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    supabase.table("assets").update({"archived_at": None, "archived_by": None}).eq("rfid_uid", rfid).execute()
    log_action(user, "device.restored", "device", rfid, {"name": asset["name"]})
    return {"status": "restored"}

# POST /assets/{rfid}/rekey (admin)
class RekeyBody(BaseModel):
    new_rfid: str

@router.post("/{rfid}/rekey", status_code=200)
def rekey_asset(rfid: str, body: RekeyBody, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    new_rfid = normalize_rfid(body.new_rfid)
    asset = _assert_asset_exists(rfid)
    # Check new RFID not taken
    existing = supabase.table("assets").select("rfid_uid").eq("rfid_uid", new_rfid).execute()
    if existing.data:
        raise HTTPException(409, detail={"error": {"code": "duplicate_rfid", "message": "New RFID is already in use"}})
    # Supabase will cascade update FK because of ON UPDATE CASCADE
    supabase.table("assets").update({"rfid_uid": new_rfid}).eq("rfid_uid", rfid).execute()
    log_action(user, "device.rekeyed", "device", new_rfid, {"old_rfid": rfid, "new_rfid": new_rfid})
    return {"old_rfid": rfid, "new_rfid": new_rfid}

# DELETE /assets/{rfid} (admin, only if no linked records)
@router.delete("/{rfid}", status_code=204)
def delete_asset(rfid: str, user: UserProfile = Depends(require_admin)):
    rfid = normalize_rfid(rfid)
    asset = _assert_asset_exists(rfid)
    # Check linked records
    for table, col in [("tickets", "asset_rfid"), ("incidents", "asset_rfid"), ("maintenance_logs", "asset_rfid")]:
        res = supabase.table(table).select("id").eq(col, rfid).limit(1).execute()
        if res.data:
            raise HTTPException(409, detail={"error": {"code": "has_linked_records", "message": f"Asset has linked {table}. Archive it instead."}})
    # Delete images from storage
    img_res = supabase.table("asset_images").select("storage_path").eq("asset_rfid", rfid).execute()
    for img in (img_res.data or []):
        delete_file(ASSET_BUCKET, img["storage_path"])
    supabase.table("assets").delete().eq("rfid_uid", rfid).execute()
    log_action(user, "device.deleted", "device", rfid, {"name": asset["name"]})

# Helper
def _assert_asset_exists(rfid: str) -> dict:
    res = supabase.table("assets").select("*").eq("rfid_uid", rfid).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Asset not found"}})
    return res.data
