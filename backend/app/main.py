import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError, HTTPException

from app.config import settings
from app.errors import validation_exception_handler, http_exception_handler
from app.routers import auth, assets, tickets, rfid, admin_users, admin_scanners, admin_audit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Capture the event loop for the SSE publisher (single worker assumption)
    from app.services.events import set_loop

    set_loop(asyncio.get_event_loop())
    logger.info("DEAM backend started")
    yield
    logger.info("DEAM backend shutting down")


app = FastAPI(
    title="DEAM Industrial Ticketing API",
    description="Industrial Ticketing + AI Triage + RFID Tap System",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)

# Routers
app.include_router(auth.router, tags=["Auth"])
app.include_router(assets.router, prefix="/assets", tags=["Assets"])
app.include_router(tickets.router, prefix="/tickets", tags=["Tickets"])
app.include_router(rfid.router, prefix="/rfid", tags=["RFID"])
app.include_router(admin_users.router, prefix="/admin/users", tags=["Admin: Users"])
app.include_router(admin_scanners.router, prefix="/admin/scanners", tags=["Admin: Scanners"])
app.include_router(admin_audit.router, prefix="/admin/audit-log", tags=["Admin: Audit"])


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
