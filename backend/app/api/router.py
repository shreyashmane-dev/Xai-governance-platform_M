from fastapi import APIRouter

from app.api.routes import analytics, chat, datasets, drift, fraud, governance, models, platform, reports, system

api_router = APIRouter()
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(governance.router, prefix="/governance", tags=["governance"])
api_router.include_router(drift.router, prefix="/drift", tags=["drift"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(fraud.router, prefix="/fraud", tags=["fraud"])
api_router.include_router(platform.router, tags=["platform"])
