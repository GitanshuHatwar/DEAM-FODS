import re

def normalize_rfid(raw: str) -> str:
    """Remove colons, dashes, spaces; uppercase."""
    cleaned = re.sub(r'[:\-\s]', '', raw)
    return cleaned.upper()
