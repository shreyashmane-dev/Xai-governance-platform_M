"""
XAI Governance Platform – FastAPI Application Entry Point
Production-ready: CORS, security headers, rate limiting, exception handling.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.router import api_router
from app.api.routes import chat as chat_routes
from app.core.config import settings
from app.core.security import init_firebase
from app.db.mongo import close_client, ensure_indexes

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("xai-governance")
STARTED_AT = datetime.now(timezone.utc)


# ─────────────────────────────────────────────
# Rate Limiter (slowapi – backed by in-memory store)
# Change to Redis backend for multi-worker deployments:
#   limiter = Limiter(key_func=get_remote_address, storage_uri="redis://...")
# ─────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ─────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_: FastAPI):
    LOGGER.info("Starting up XAI Governance API (env=%s)", settings.environment)
    init_firebase()
    try:
        await asyncio.wait_for(ensure_indexes(), timeout=10)
    except asyncio.TimeoutError:
        LOGGER.warning("MongoDB index creation timed out – continuing anyway")
    except Exception as exc:  # noqa: BLE001
        LOGGER.error("MongoDB index error: %s", exc)
        if settings.environment != "development":
            raise
    yield
    LOGGER.info("Shutting down – closing MongoDB client")
    await close_client()


# ─────────────────────────────────────────────
# App factory
# ─────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    description="XAI Governance Platform REST API",
    version="1.0.0",
    debug=False,                          # NEVER enable debug in production
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    openapi_url="/openapi.json" if settings.environment != "production" else None,
    lifespan=lifespan,
)

# ─────────────────────────────────────────────
# Rate-limiter state (must be attached before SlowAPIMiddleware)
# ─────────────────────────────────────────────
app.state.limiter = limiter


# ─────────────────────────────────────────────
# CORS Middleware
#
# Security note: allow_origins=["*"] + allow_credentials=True is forbidden
# by the Fetch spec (browsers reject it). We work around this by echoing
# the requesting Origin back when credentials are involved; for non-credentialed
# requests the wildcard is perfectly fine.
#
# The allow_origin_regex below covers:
#   • http(s)://anything (any domain, any port)
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,          # list from env or ["*"]
    allow_origin_regex=r"https?://.*",            # catch-all: every http/https origin
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-API-Key",
        "x-api-key",
    ],
    expose_headers=["X-Request-ID"],
    max_age=600,                                  # cache preflight for 10 min
)

# ─────────────────────────────────────────────
# Rate-Limiter Middleware
# ─────────────────────────────────────────────
app.add_middleware(SlowAPIMiddleware)


# ─────────────────────────────────────────────
# Security Headers Middleware + Optional API-Key Guard
# ─────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security response headers and enforces optional API-key auth."""

    async def dispatch(self, request: Request, call_next):
        # ── Optional API-key protection on /api/* routes ──────────────────
        if settings.api_key and request.url.path.startswith("/api"):
            provided = request.headers.get("x-api-key") or request.headers.get("X-API-Key")
            if not provided or provided != settings.api_key:
                return JSONResponse(
                    status_code=401,
                    content={"success": False, "detail": "Invalid or missing API key"},
                )

        response = await call_next(request)

        # ── Security Headers ───────────────────────────────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        # HSTS – only in production over HTTPS
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


app.add_middleware(SecurityHeadersMiddleware)


# ─────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────
app.include_router(api_router, prefix="/api")
# Backward-compatible direct chat path for legacy/frontends not using /api prefix
app.include_router(chat_routes.router, prefix="/chat", tags=["chat"])


# ─────────────────────────────────────────────
# Health-check endpoints (no auth required)
# ─────────────────────────────────────────────
@app.get("/", tags=["Health"], summary="Root health check")
async def root():
    """Returns API status and uptime. Used by Render health checks."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.environment,
        "version": "1.0.0",
        "started_at": STARTED_AT.isoformat(),
        "uptime_seconds": (datetime.now(timezone.utc) - STARTED_AT).seconds,
    }


@app.get("/health", tags=["Health"], summary="Detailed health check")
async def health():
    return {"status": "ok", "started_at": STARTED_AT.isoformat()}


@app.get("/healthz", tags=["Health"], summary="Kubernetes-style liveness probe")
async def healthz():
    return {"ok": True}


# ─────────────────────────────────────────────
# Exception Handlers
# ─────────────────────────────────────────────
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"success": False, "detail": "Too many requests – slow down and retry."},
        headers={"Retry-After": "60"},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "detail": "Request validation failed",
            "errors": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    LOGGER.exception(
        "Unhandled error on %s %s", request.method, request.url.path, exc_info=exc
    )
    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": "Internal server error"},
    )


# ─────────────────────────────────────────────
# Local dev entry-point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", settings.port))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.environment == "development",
        log_level="info",
        access_log=True,
        proxy_headers=True,          # Trust X-Forwarded-For from Render's proxy
        forwarded_allow_ips="*",
    )
