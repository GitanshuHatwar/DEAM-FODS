from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.deps import require_admin, UserProfile
from app.db import supabase
from app.services.admin_users import assert_not_self, assert_last_admin, assert_no_linked_records
from app.services.audit import log_action

router = APIRouter()

class CreateUserBody(BaseModel):
    email: str
    full_name: str
    role: str
    password: str

class EditUserBody(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None

class ResetPasswordBody(BaseModel):
    new_password: str


@router.get("")
def list_users(role: Optional[str] = None, active: Optional[bool] = None, q: Optional[str] = None, user: UserProfile = Depends(require_admin)):
    query = supabase.table("profiles").select("*")
    if role:
        query = query.eq("role", role)
    if active is not None:
        query = query.eq("is_active", active)
    res = query.execute()
    users = res.data or []
    if q:
        q_lower = q.lower()
        users = [u for u in users if q_lower in u.get("full_name", "").lower()]
    return users


@router.post("", status_code=201)
def create_user(body: CreateUserBody, user: UserProfile = Depends(require_admin)):
    if body.role not in ("customer", "technician", "admin"):
        raise HTTPException(400, detail={"error": {"code": "validation_error", "message": "Invalid role"}})
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"full_name": body.full_name},
        })
        new_user = auth_res.user
    except Exception as e:
        if "already" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(409, detail={"error": {"code": "duplicate_email", "message": "Email already in use"}})
        raise HTTPException(400, detail={"error": {"code": "error", "message": str(e)}})
    
    # Create profile (trigger creates a customer profile; we upsert with the correct role)
    supabase.table("profiles").upsert({
        "id": str(new_user.id),
        "full_name": body.full_name,
        "role": body.role,
        "is_active": True,
        "created_by": user.id,
    }).execute()
    
    log_action(user, "user.created", "user", str(new_user.id), {"email": body.email, "role": body.role})
    return {"id": str(new_user.id), "email": body.email, "full_name": body.full_name, "role": body.role, "is_active": True}


@router.get("/{user_id}")
def get_user(user_id: str, user: UserProfile = Depends(require_admin)):
    res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not res.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "User not found"}})
    return res.data


@router.patch("/{user_id}")
def edit_user(user_id: str, body: EditUserBody, user: UserProfile = Depends(require_admin)):
    target = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not target.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "User not found"}})
    old = target.data
    
    updates = {}
    details = {}
    
    if body.full_name is not None:
        updates["full_name"] = body.full_name
        details["full_name"] = {"from": old["full_name"], "to": body.full_name}
    
    if body.role is not None:
        if body.role == old["role"]:
            pass
        else:
            if old["role"] == "admin":
                assert_not_self(user.id, user_id, "demote")
                assert_last_admin(exclude_id=user_id)
            updates["role"] = body.role
            details["role"] = {"from": old["role"], "to": body.role}
    
    if updates:
        supabase.table("profiles").update(updates).eq("id", user_id).execute()
        action = "user.role_changed" if "role" in details else "user.updated"
        log_action(user, action, "user", user_id, details)
    return {**old, **updates}


@router.post("/{user_id}/deactivate")
def deactivate_user(user_id: str, user: UserProfile = Depends(require_admin)):
    assert_not_self(user.id, user_id, "deactivate")
    target = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not target.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "User not found"}})
    if target.data.get("role") == "admin":
        assert_last_admin(exclude_id=user_id)
    supabase.table("profiles").update({"is_active": False}).eq("id", user_id).execute()
    # Suspend Supabase account (ban_duration = effectively forever)
    try:
        supabase.auth.admin.update_user_by_id(user_id, {"ban_duration": "87600h"})
    except Exception:
        pass
    log_action(user, "user.deactivated", "user", user_id, {"name": target.data["full_name"]})
    return {"status": "deactivated"}


@router.post("/{user_id}/reactivate")
def reactivate_user(user_id: str, user: UserProfile = Depends(require_admin)):
    target = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not target.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "User not found"}})
    supabase.table("profiles").update({"is_active": True}).eq("id", user_id).execute()
    try:
        supabase.auth.admin.update_user_by_id(user_id, {"ban_duration": "none"})
    except Exception:
        pass
    log_action(user, "user.reactivated", "user", user_id, {"name": target.data["full_name"]})
    return {"status": "reactivated"}


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, body: ResetPasswordBody, user: UserProfile = Depends(require_admin)):
    try:
        supabase.auth.admin.update_user_by_id(user_id, {"password": body.new_password})
    except Exception as e:
        raise HTTPException(400, detail={"error": {"code": "error", "message": str(e)}})
    log_action(user, "user.password_reset", "user", user_id, {})
    return {"status": "password_reset"}


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: str, user: UserProfile = Depends(require_admin)):
    assert_not_self(user.id, user_id, "delete")
    target = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not target.data:
        raise HTTPException(404, detail={"error": {"code": "not_found", "message": "User not found"}})
    if target.data.get("role") == "admin":
        assert_last_admin(exclude_id=user_id)
    assert_no_linked_records(user_id)
    log_action(user, "user.deleted", "user", user_id, {"email": target.data.get("full_name", "")})
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(400, detail={"error": {"code": "error", "message": str(e)}})
