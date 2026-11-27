import hashlib

from fastapi import Header, HTTPException, Depends
from pydantic import BaseModel

from app.db import supabase


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str = ""


def get_current_user(authorization: str = Header(...)) -> UserProfile:
    """Validates Bearer token, loads profile, rejects inactive users."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            401,
            detail={"error": {"code": "invalid_token", "message": "Missing bearer token"}},
        )
    token = authorization.removeprefix("Bearer ").strip()
    try:
        resp = supabase.auth.get_user(token)
        auth_user = resp.user
        if not auth_user:
            raise ValueError("No user")
    except Exception:
        raise HTTPException(
            401,
            detail={"error": {"code": "invalid_token", "message": "Invalid or expired token"}},
        )

    profile_resp = (
        supabase.table("profiles")
        .select("*")
        .eq("id", str(auth_user.id))
        .single()
        .execute()
    )
    if not profile_resp.data:
        raise HTTPException(
            401,
            detail={"error": {"code": "invalid_token", "message": "Profile not found"}},
        )

    profile = profile_resp.data
    if not profile["is_active"]:
        raise HTTPException(
            403,
            detail={"error": {"code": "inactive_user", "message": "Account is deactivated"}},
        )

    return UserProfile(
        id=str(auth_user.id),
        email=auth_user.email or "",
        full_name=profile["full_name"],
        role=profile["role"],
        is_active=profile["is_active"],
        created_at=str(profile.get("created_at") or ""),
    )


def require_technician_or_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if user.role not in ("technician", "admin"):
        raise HTTPException(
            403,
            detail={"error": {"code": "forbidden", "message": "Technician or admin required"}},
        )
    return user


def require_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    if user.role != "admin":
        raise HTTPException(
            403,
            detail={"error": {"code": "forbidden", "message": "Admin required"}},
        )
    return user


def verify_scanner(x_device_key: str = Header(...)):
    """Verifies the ESP scanner key. Returns the scanner row."""
    # We need the scanner_code from the request body, but headers can't carry it here.
    # The router extracts scanner_id from the body and passes it; this dep is used differently.
    # Instead: expose a helper function called in the router.
    pass


def check_scanner(scanner_id: str, device_key: str) -> dict:
    """Call this from the rfid tap router to verify the scanner key."""
    res = (
        supabase.table("scanners")
        .select("*")
        .eq("scanner_code", scanner_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(
            401,
            detail={"error": {"code": "invalid_token", "message": "Unknown scanner"}},
        )
    scanner = res.data
    if not scanner["is_active"]:
        raise HTTPException(
            401,
            detail={"error": {"code": "invalid_token", "message": "Scanner is inactive"}},
        )
    key_hash = hashlib.sha256(device_key.encode()).hexdigest()
    if key_hash != scanner["api_key_hash"]:
        raise HTTPException(
            401,
            detail={"error": {"code": "invalid_token", "message": "Invalid device key"}},
        )
    # Update last_seen_at
    supabase.table("scanners").update({"last_seen_at": "now()"}).eq("id", scanner["id"]).execute()
    return scanner
