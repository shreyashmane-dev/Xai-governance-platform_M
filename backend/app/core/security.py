import firebase_admin
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)
FIREBASE_READY = False


def init_firebase() -> None:
    global FIREBASE_READY
    if firebase_admin._apps:
        FIREBASE_READY = True
        return

    cert = {
        "type": "service_account",
        "project_id": settings.firebase_project_id,
        "private_key": settings.firebase_private_key.replace("\\n", "\n"),
        "client_email": settings.firebase_client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    try:
        firebase_admin.initialize_app(credentials.Certificate(cert))
        FIREBASE_READY = True
    except Exception:
        if settings.environment == "development":
            FIREBASE_READY = False
            return
        raise


async def verify_token(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)) -> dict:
    if not FIREBASE_READY and settings.environment == "development":
        return {
            "uid": "dev-user",
            "email": "dev@example.com",
            "name": "Development User",
            "tenant_id": "default",
            "claims": {"dev_mode": True},
        }

    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        decoded = auth.verify_id_token(credentials.credentials, check_revoked=True)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if decoded.get("aud") != settings.firebase_project_id:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    firebase_claims = decoded.get("firebase", {})
    tenant_id = firebase_claims.get("tenant") or decoded.get("tenant_id") or "default"

    return {
        "uid": decoded.get("uid"),
        "email": decoded.get("email", ""),
        "name": decoded.get("name", ""),
        "tenant_id": tenant_id,
        "claims": decoded,
    }
