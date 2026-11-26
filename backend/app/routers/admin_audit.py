from fastapi import APIRouter, Depends
from typing import Optional
from app.deps import require_admin, UserProfile
from app.db import supabase

router = APIRouter()

@router.get("")
def get_audit_log(
    actor: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    user: UserProfile = Depends(require_admin),
):
    query = supabase.table("admin_audit_log").select("*")
    if actor:
        query = query.eq("actor_id", actor)
    if action:
        query = query.eq("action", action)
    if from_date:
        query = query.gte("created_at", from_date)
    if to_date:
        query = query.lte("created_at", to_date)
    offset = (page - 1) * page_size
    res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    return {"data": res.data or [], "page": page, "page_size": page_size}
