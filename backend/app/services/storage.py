import os
import uuid
import logging
from fastapi import HTTPException, UploadFile
from app.db import supabase
from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
TICKET_BUCKET = "ticket-images"
ASSET_BUCKET = "asset-images"


def _validate_image(file: UploadFile) -> bytes:
    content = file.file.read()
    if len(content) > settings.max_image_bytes:
        raise HTTPException(413, detail={"error": {"code": "file_too_large", "message": f"Image must be under {settings.max_image_bytes // 1024} KB"}})
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, detail={"error": {"code": "unsupported_file_type", "message": "Only JPEG, PNG and WebP images are allowed"}})
    return content


def upload_ticket_image(ticket_id: str, file: UploadFile) -> str:
    content = _validate_image(file)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    path = f"{ticket_id}/{uuid.uuid4().hex}.{ext}"
    supabase.storage.from_(TICKET_BUCKET).upload(path, content, {"content-type": file.content_type})
    return path


def upload_asset_image(image_id: str, file: UploadFile) -> str:
    content = _validate_image(file)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    path = f"{image_id}.{ext}"
    supabase.storage.from_(ASSET_BUCKET).upload(path, content, {"content-type": file.content_type})
    return path


def get_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    try:
        resp = supabase.storage.from_(bucket).create_signed_url(path, expires_in)
        return resp.get("signedURL", "") or resp.get("signed_url", "")
    except Exception as e:
        logger.warning("Could not sign URL for %s/%s: %s", bucket, path, e)
        return ""


def delete_file(bucket: str, path: str) -> None:
    try:
        supabase.storage.from_(bucket).remove([path])
    except Exception as e:
        logger.warning("Could not delete %s/%s: %s", bucket, path, e)
