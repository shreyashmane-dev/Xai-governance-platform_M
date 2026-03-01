from app.core.config import settings
from app.db.local_db import LocalDB

_local_db: LocalDB | None = None


def get_client():
    # Local JSON-backed DB does not expose a separate client object.
    return _local_db


async def check_connection() -> bool:
    try:
        db = get_db()
        await db.command("ping")
        return True
    except Exception:
        return False


def get_db() -> LocalDB:
    global _local_db
    if _local_db is None:
        _local_db = LocalDB(settings.mongo_db_name)
    return _local_db


async def close_client() -> None:
    # No-op for local JSON-backed DB.
    return None


async def ensure_indexes() -> None:
    # No-op for local JSON-backed DB.
    return None
