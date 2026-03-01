from fastapi import APIRouter

from app.api.routes import (
    assistant,
    analytics,
    chat,
    datasets,
    drift,
    evaluations,
    governance,
    models,
    platform,
    reports,
    search,
    system,
)

api_router = APIRouter()
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
api_router.include_router(governance.router, prefix="/governance", tags=["governance"])
api_router.include_router(drift.router, prefix="/drift", tags=["drift"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(reports.router, prefix="/report", tags=["reports"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(platform.router, tags=["platform"])
