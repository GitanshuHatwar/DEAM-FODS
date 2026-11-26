import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.deps import require_admin, UserProfile
from app.db import supabase
from app.services.audit import log_action
import uuid

router = APIRouter()

def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

class CreateScannerBody(BaseModel):
    scanner_code: str
    location: Optional[str] = None

class UpdateScannerBody(BaseModel):
    location: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("")
def list_scanners(user: UserProfile = Depends(require_admin)):
    res = supabase.table("scanners").select("id,scanner_code,location,is_active,last_seen_at,created_at").execute()
    return res.data or []

@router.post("", status_code=201)
def create_scanner(body: CreateScannerBody, user: UserProfile = Depends(require_admin)):
    existing = supabase.table("scanners").select("id").eq("scanner_code", body.scanner_code).execute()
    if existing.data:
        raise HTTPException(409, detail={"error": {"code": "validation_error", "message": "Scanner code already exists"}})
    raw_key = secrets.token_urlsafe(32)
    key_hash = _hash_key(raw_key)
    scanner_id = str(uuid.uuid4())
    supabase.table("scanners").insert({
        "id": scanner_id,
        "scanner_code": body.scanner_code,
        "location": body.location,
        "api_key_hash": key_hash,
        "is_active": True,
        "created_by": user.id,
    }).execute()
    log_action(user, "scanner.created", "scanner", scanner_id, {"scanner_code": body.scanner_code})
    return {"id": scanner_id, "scanner_code": body.scanner_code, "location": body.location, "device_key": raw_key, "is_active": True}

@router.patch("/{scanner_id}")
def update_scanner(scanner_id: str, body: UpdateScannerBody, user: UserProfile = Depends(require_admin)):
    res = supabase.table("scanners").select("*").eq("id", scanner_id).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Scanner not found"}})
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        supabase.table("scanners").update(updates).eq("id", scanner_id).execute()
        if body.is_active is False:
            log_action(user, "scanner.deactivated", "scanner", scanner_id, {})
    return {**res.data, **updates}

@router.post("/{scanner_id}/rotate-key")
def rotate_key(scanner_id: str, user: UserProfile = Depends(require_admin)):
    res = supabase.table("scanners").select("*").eq("id", scanner_id).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "Scanner not found"}})
    raw_key = secrets.token_urlsafe(32)
    key_hash = _hash_key(raw_key)
    supabase.table("scanners").update({"api_key_hash": key_hash}).eq("id", scanner_id).execute()
    log_action(user, "scanner.key_rotated", "scanner", scanner_id, {})
    return {"scanner_id": scanner_id, "device_key": raw_key, "note": "Store this key on the ESP device; it will not be shown again"}
