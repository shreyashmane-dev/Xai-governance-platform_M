from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.api.router import api_router
from app.core.config import settings
from app.core.security import init_firebase
from app.db.mongo import close_client, ensure_indexes

STARTED_AT = datetime.now(timezone.utc)
LOGGER = logging.getLogger("xai-governance")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_firebase()
    try:
        await asyncio.wait_for(ensure_indexes(), timeout=10)
    except Exception:
        if settings.environment != "development":
            raise
    yield
    await close_client()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.backend_cors_origins.split(",")],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "started_at": STARTED_AT.isoformat()}


@app.get("/healthz")
async def healthz():
    return {"ok": True}


app.include_router(api_router, prefix="/api")


@app.middleware("http")
async def safe_error_and_cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    try:
        response = await call_next(request)
    except Exception as exc:
        LOGGER.exception("Unhandled request error: %s %s", request.method, request.url.path, exc_info=exc)
        response = JSONResponse(status_code=500, content={"success": False, "detail": "Internal server error"})

    if origin and (origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    LOGGER.exception("Unhandled error for %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"success": False, "detail": "Internal server error"})
