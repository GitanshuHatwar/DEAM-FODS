from fastapi import HTTPException
from app.db import supabase
import logging

logger = logging.getLogger(__name__)


def assert_not_self(actor_id: str, target_id: str, action: str = "action") -> None:
    if actor_id == target_id:
        raise HTTPException(409, detail={"error": {"code": "self_action_not_allowed", "message": f"Cannot {action} your own account"}})


def assert_last_admin(exclude_id: str | None = None) -> None:
    """Raise 409 if there would be no active admins after removing/demoting exclude_id."""
    res = supabase.table("profiles").select("id").eq("role", "admin").eq("is_active", True).execute()
    admins = res.data or []
    remaining = [a for a in admins if str(a["id"]) != exclude_id] if exclude_id else admins
    if len(remaining) == 0:
        raise HTTPException(409, detail={"error": {"code": "last_admin", "message": "Cannot remove the last active admin"}})


def assert_no_linked_records(user_id: str) -> None:
    """Raise 409 if the user has any tickets raised, resolved, or any incident/maintenance records."""
    tickets_raised = supabase.table("tickets").select("id").eq("raised_by", user_id).limit(1).execute()
    if tickets_raised.data:
        raise HTTPException(409, detail={"error": {"code": "has_linked_records", "message": "User has linked tickets. Deactivate the account instead."}})

    tickets_resolved = supabase.table("tickets").select("id").eq("resolved_by", user_id).limit(1).execute()
    if tickets_resolved.data:
        raise HTTPException(409, detail={"error": {"code": "has_linked_records", "message": "User has resolved tickets. Deactivate the account instead."}})

    incidents = supabase.table("incidents").select("id").eq("created_by", user_id).limit(1).execute()
    if incidents.data:
        raise HTTPException(409, detail={"error": {"code": "has_linked_records", "message": "User has linked incident records. Deactivate the account instead."}})
