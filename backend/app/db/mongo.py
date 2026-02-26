from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.core.config import settings

client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global client
    if client is None:
        client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    return client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongo_db_name]


async def close_client() -> None:
    global client
    if client is not None:
        client.close()
        client = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index([("firebase_uid", ASCENDING)], unique=True)
    await db.users.create_index([("org_id", ASCENDING), ("role", ASCENDING)])

    await db.models.create_index([("tenant_id", ASCENDING), ("name", ASCENDING), ("version", ASCENDING)], unique=True, sparse=True)
    await db.models.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.models.create_index([("checksum", ASCENDING)])

    await db.datasets.create_index([("tenant_id", ASCENDING), ("name", ASCENDING), ("version", ASCENDING)], unique=True, sparse=True)
    await db.datasets.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])

    await db.metrics.create_index([("tenant_id", ASCENDING), ("model_id", ASCENDING), ("dataset_id", ASCENDING), ("created_at", DESCENDING)])
    await db.shap_reports.create_index([("tenant_id", ASCENDING), ("model_id", ASCENDING), ("dataset_id", ASCENDING), ("created_at", DESCENDING)])
    await db.governance_reports.create_index([("tenant_id", ASCENDING), ("model_id", ASCENDING), ("dataset_id", ASCENDING), ("created_at", DESCENDING)])
    await db.drift_reports.create_index([("tenant_id", ASCENDING), ("baseline_dataset_id", ASCENDING), ("current_dataset_id", ASCENDING), ("created_at", DESCENDING)])

    await db.reports.create_index([("tenant_id", ASCENDING), ("model_id", ASCENDING), ("created_at", DESCENDING)])
    await db.reports.create_index([("checksum", ASCENDING)], sparse=True)

    await db.audit_logs.create_index([("tenant_id", ASCENDING), ("created_at", DESCENDING)])
    await db.audit_logs.create_index([("resource_type", ASCENDING), ("resource_id", ASCENDING)])
    await db.audit_logs.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

    await db.chat_history.create_index([("tenant_id", ASCENDING), ("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.chat_history.create_index([("session_id", ASCENDING), ("created_at", DESCENDING)])
