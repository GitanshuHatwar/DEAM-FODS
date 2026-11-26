from datetime import datetime, timezone

def compute_base_priority(ai_score: float, criticality: int, safety_risk: bool) -> float:
    score = 0.6 * ai_score + 6 * criticality
    if safety_risk:
        score += 25
    return min(score, 100.0)

def compute_effective_priority(base_priority: float, created_at: datetime, override: float | None) -> float:
    if override is not None:
        return float(override)
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    hours_open = (now - created_at).total_seconds() / 3600
    aging = max(0.0, min(hours_open * 0.1, 10.0))
    return base_priority + aging
