from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.db import supabase
from app.deps import UserProfile, require_admin

router = APIRouter()


@router.get("")
def get_audit_log(
    actor: Optional[str] = None,
    action: Optional[str] = None,
    from_alias: Optional[str] = Query(default=None, alias="from"),
    to_alias: Optional[str] = Query(default=None, alias="to"),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    user: UserProfile = Depends(require_admin),
):
    start = from_alias or from_date
    end = to_alias or to_date

    query = supabase.table("admin_audit_log").select("*", count="exact")
    if actor:
        query = query.eq("actor_id", actor)
    if action:
        query = query.eq("action", action)
    if start:
        query = query.gte("created_at", start)
    if end:
        query = query.lte("created_at", end)

    offset = (page - 1) * page_size
    res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    items = res.data or []
    total = res.count if res.count is not None else len(items)
    return {"items": items, "total": total, "page": page, "page_size": page_size}
