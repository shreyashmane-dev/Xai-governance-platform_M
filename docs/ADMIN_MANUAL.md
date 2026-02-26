# Admin Manual

## Tenant & Access
- Manage users via Firebase Auth.
- Enforce tenant claims in JWT if multi-tenant mode is enabled.

## Security Controls
- Configure strict CORS via `BACKEND_CORS_ORIGINS`.
- Rotate keys for OpenAI and Firebase service account.
- Enforce upload size and file type constraints.

## Operations
- Monitor `/health` and `/healthz`.
- Review `audit_logs` collection for action history.
- Review `chat_history` for AI usage and fallbacks.

## Data Governance
- Configure data retention policy for reports and logs.
- Define protected attributes for fairness scans.
- Maintain model versioning discipline (`name` + `version`).

## Incident Response
- If token validation fails system-wide, verify Firebase cert values.
- If model execution fails, inspect model compatibility and dataset schema.
- If drift spikes, review upstream data pipeline changes.
