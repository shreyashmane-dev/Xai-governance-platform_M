from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

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


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    debug=False,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "service": settings.app_name, "started_at": STARTED_AT.isoformat()}


@app.get("/health")
async def health():
    return {"status": "ok", "started_at": STARTED_AT.isoformat()}


@app.get("/healthz")
async def healthz():
    return {"ok": True}


app.include_router(api_router, prefix="/api")


@app.middleware("http")
async def security_headers_and_optional_api_key(request: Request, call_next):
    if settings.api_key and request.url.path.startswith("/api"):
        provided = request.headers.get("x-api-key")
        if not provided or provided != settings.api_key:
            return JSONResponse(status_code=401, content={"success": False, "detail": "Invalid API key"})

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"success": False, "detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"success": False, "detail": "Validation error", "errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    LOGGER.exception("Unhandled error for %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=False)
