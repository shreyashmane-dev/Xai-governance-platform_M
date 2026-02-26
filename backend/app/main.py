"""
XAI Governance Platform FastAPI application entry point.
Production-ready CORS, security headers, rate limiting, and exception handling.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import logging
import os
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

from app.api.router import api_router
from app.api.routes import chat as chat_routes
from app.core.config import settings
from app.core.security import init_firebase
from app.db.mongo import close_client, ensure_indexes

logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("xai-governance")
STARTED_AT = datetime.now(timezone.utc)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(_: FastAPI):
    env_name = os.getenv("ENVIRONMENT", settings.environment)
    port_val = os.getenv("PORT", "unknown")
    LOGGER.info("Starting up XAI Governance API (env=%s, port=%s)", env_name, port_val)

    try:
        os.makedirs(settings.upload_dir, exist_ok=True)
        LOGGER.info("Upload directory verified: %s", settings.upload_dir)
    except Exception as exc:
        LOGGER.error("Failed to create upload directory %s: %s", settings.upload_dir, exc)

    init_firebase()
    try:
        await asyncio.wait_for(ensure_indexes(), timeout=15)
        LOGGER.info("MongoDB indexes verified")
    except asyncio.TimeoutError:
        LOGGER.warning("MongoDB index creation timed out, continuing")
    except Exception as exc:  # noqa: BLE001
        LOGGER.error("Critical MongoDB index error: %s", exc)
        if settings.is_production:
            pass

    yield

    LOGGER.info("Shutting down and closing MongoDB client")
    await close_client()


app = FastAPI(
    title=settings.app_name,
    description="XAI Governance Platform REST API",
    version="1.0.0",
    debug=False,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
    openapi_url="/openapi.json" if settings.environment != "production" else None,
    lifespan=lifespan,
)
app.state.limiter = limiter


cors_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://xai-governance-platform.vercel.app",
    "https://xai-trustops.vercel.app",
]

# Add any custom origins from settings
if settings.backend_cors_origins and settings.backend_cors_origins != "*":
    for origin in settings.backend_cors_origins.split(","):
        clean = origin.strip()
        if clean and clean not in cors_origins:
            cors_origins.append(clean)

if settings.backend_cors_origins == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
        max_age=3600,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
        max_age=3600,
    )

app.add_middleware(SlowAPIMiddleware)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or uuid4().hex
        request.state.request_id = request_id
        started = datetime.now(timezone.utc)

        if settings.api_key and request.url.path.startswith("/api"):
            provided = request.headers.get("x-api-key") or request.headers.get("X-API-Key")
            if not provided or provided != settings.api_key:
                return JSONResponse(
                    status_code=401,
                    content={"success": False, "detail": "Invalid or missing API key", "request_id": request_id},
                )

        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Request-ID"] = request_id

        elapsed_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        LOGGER.info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.include_router(api_router, prefix="/api")
app.include_router(chat_routes.router, prefix="/chat", tags=["chat"])


@app.get("/", tags=["Health"], summary="Root health check")
async def root():
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
    return {
        "status": "ok",
        "started_at": STARTED_AT.isoformat(),
        "storage": {
            "backend": settings.storage_backend,
            "upload_dir": settings.upload_dir,
        },
        "compatibility": {
            "strict_feature_compatibility": settings.strict_feature_compatibility,
        },
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)


@app.get("/healthz", tags=["Health"], summary="Kubernetes-style liveness probe")
async def healthz():
    return {"ok": True}


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    _ = exc
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "detail": "Too many requests, slow down and retry.",
            "request_id": getattr(request.state, "request_id", None),
        },
        headers={"Retry-After": "60"},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "detail": exc.detail,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "detail": "Request validation failed",
            "errors": exc.errors(),
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    LOGGER.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "detail": "Internal server error",
            "request_id": getattr(request.state, "request_id", None),
        },
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", settings.port))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.environment == "development",
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
