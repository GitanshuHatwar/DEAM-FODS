import asyncio
import json
import logging
from typing import List

logger = logging.getLogger(__name__)

_subscribers: List[asyncio.Queue] = []
_latest_tap: dict | None = None
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def get_latest_tap() -> dict | None:
    return _latest_tap


def publish_tap(data: dict) -> None:
    global _latest_tap
    _latest_tap = data
    if _loop is None:
        logger.warning("SSE loop not set; event dropped")
        return
    for q in list(_subscribers):
        _loop.call_soon_threadsafe(q.put_nowait, data)


async def subscribe():
    """Async generator yielding SSE-formatted strings."""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)
    logger.info("SSE subscriber added (total=%d)", len(_subscribers))
    try:
        while True:
            data = await q.get()
            yield f"data: {json.dumps(data)}\n\n"
    finally:
        _subscribers.remove(q)
        logger.info("SSE subscriber removed (total=%d)", len(_subscribers))
