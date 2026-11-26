import json
import logging
from google import genai
from google.genai import types
from app.config import settings
from app.db import supabase

logger = logging.getLogger(__name__)

FALLBACK = {
    "ai_severity": "medium",
    "ai_score": 50,
    "ai_safety_risk": False,
    "ai_probable_cause": "Could not determine automatically",
    "ai_summary": "AI analysis unavailable; manual review required",
    "ai_status": "fallback",
}

SYSTEM_PROMPT = """You are an industrial maintenance AI. Analyze the ticket and return a JSON object with these exact keys:
- severity: one of "critical", "high", "medium", "low"
- score: integer 0-100 (100 = most critical)
- safety_risk: boolean (true if there is a risk of injury or severe equipment damage)
- probable_cause: short string (1-2 sentences)
- summary: short string (1-2 sentences describing urgency and recommendation)
Return ONLY valid JSON, no markdown."""


def analyze_ticket(ticket_id: str, description: str, device: dict, last_incidents: list, image_paths: list) -> None:
    """
    Background task: calls Gemini, updates the ticket row.
    Runs up to 2 attempts; falls back to FALLBACK values on total failure.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt_text = f"""
Device: {device.get('name')} (Model: {device.get('model','N/A')}, Criticality: {device.get('criticality')}/5, Location: {device.get('location','N/A')})
Issue description: {description}
Last {len(last_incidents)} incident(s): {json.dumps(last_incidents, default=str)}
"""

    contents: list = [prompt_text]
    # We don't inline images for V1 (would need storage download). Pass text only.

    result = None
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                ),
            )
            raw_text = response.text.strip()
            parsed = json.loads(raw_text)
            result = {
                "ai_severity": parsed.get("severity", "medium"),
                "ai_score": int(parsed.get("score", 50)),
                "ai_safety_risk": bool(parsed.get("safety_risk", False)),
                "ai_probable_cause": parsed.get("probable_cause", ""),
                "ai_summary": parsed.get("summary", ""),
                "ai_raw": parsed,
                "ai_status": "done",
            }
            break
        except Exception as e:
            logger.warning("Gemini attempt %d failed: %s", attempt + 1, e)

    if result is None:
        result = {**FALLBACK, "ai_raw": {}}

    # Compute base priority
    from app.services.priority import compute_base_priority
    base = compute_base_priority(result["ai_score"], device.get("criticality", 3), result["ai_safety_risk"])
    result["priority_score"] = base

    supabase.table("tickets").update(result).eq("id", ticket_id).execute()
    logger.info("AI analysis complete for ticket %s: %s", ticket_id, result["ai_status"])
