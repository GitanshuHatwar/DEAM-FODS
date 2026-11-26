from datetime import datetime, timezone, timedelta
from app.db import supabase
from app.services.events import get_latest_tap

STALE_SECONDS = 30

def get_latest_tap_or_none() -> dict | None:
    tap = get_latest_tap()
    if not tap:
        return None
    tapped_at_str = tap.get("tapped_at", "")
    try:
        tapped_at = datetime.fromisoformat(tapped_at_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - tapped_at > timedelta(seconds=STALE_SECONDS):
            return None
    except Exception:
        return None
    return tap
