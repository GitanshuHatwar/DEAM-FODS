from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.deps import UserProfile, check_scanner, require_technician_or_admin
from app.services.events import subscribe
from app.services.snapshot import get_latest_tap_or_none
from app.services.tap import process_tap

router = APIRouter()


class TapRequest(BaseModel):
    rfid_uid: str
    scanner_id: str


@router.post("/tap")
def rfid_tap(body: TapRequest, x_device_key: str = Header(...)):
    scanner = check_scanner(body.scanner_id, x_device_key)
    return process_tap(scanner, body.rfid_uid)


@router.get("/stream")
async def rfid_stream(user: UserProfile = Depends(require_technician_or_admin)):
    async def event_generator():
        async for event in subscribe():
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/latest")
def rfid_latest(user: UserProfile = Depends(require_technician_or_admin)):
    return get_latest_tap_or_none()
