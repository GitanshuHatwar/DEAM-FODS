from app.db import supabase
from app.deps import UserProfile
import logging

logger = logging.getLogger(__name__)


def log_action(actor: UserProfile, action: str, target_type: str, target_id: str, details: dict) -> None:
    """Write one row to admin_audit_log. Never raises (audit failure must not block the action)."""
    try:
        supabase.table("admin_audit_log").insert({
            "actor_id": actor.id,
            "actor_name": actor.full_name,
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id),
            "details": details,
        }).execute()
    except Exception as e:
        logger.error("Audit log write failed: %s", e)
