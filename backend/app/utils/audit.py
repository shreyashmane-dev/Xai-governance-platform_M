from datetime import datetime, timezone
from uuid import uuid4


async def write_audit(db, tenant_id: str, user_id: str, action: str, resource_type: str, resource_id: str, metadata: dict | None = None):
    await db.audit_logs.insert_one(
        {
            'audit_id': str(uuid4()),
            'tenant_id': tenant_id,
            'user_id': user_id,
            'action': action,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'metadata': metadata or {},
            'created_at': datetime.now(timezone.utc),
        }
    )
