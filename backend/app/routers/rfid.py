from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.deps import require_technician_or_admin, check_scanner, UserProfile
from app.services.tap import process_tap
from app.services.events import subscribe, get_latest_tap
from app.services.snapshot import get_latest_tap_or_none
import asyncio

router = APIRouter()

class TapRequest(BaseModel):
    rfid_uid: str
    scanner_id: str

@router.post("/tap")
def rfid_tap(body: TapRequest, x_device_key: str = Header(...)):
    scanner = check_scanner(body.scanner_id, x_device_key)
    result = process_tap(scanner, body.rfid_uid)
    return result

@router.get("/stream")
async def rfid_stream(user: UserProfile = Depends(require_technician_or_admin)):
    async def event_generator():
        # Send a keepalive comment every 15 seconds
        async def keepalive():
            while True:
                await asyncio.sleep(15)
                yield ": keepalive\n\n"
        
        async for event in subscribe():
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )

@router.get("/latest")
def rfid_latest(user: UserProfile = Depends(require_technician_or_admin)):
    tap = get_latest_tap_or_none()
    if not tap:
        return {"tap": None}
    return {"tap": tap}
