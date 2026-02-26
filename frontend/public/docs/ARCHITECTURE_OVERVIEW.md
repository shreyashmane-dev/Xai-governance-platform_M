# Architecture Overview

## Data Flow
`React SPA -> FastAPI API -> MongoDB Atlas`

`FastAPI -> sklearn/SHAP engine`

`FastAPI -> OpenAI API (chat proxy)`

## Request Lifecycle
1. Frontend sends Axios request with Firebase ID token.
2. FastAPI verifies token and tenant identity.
3. Endpoint validates payload via Pydantic.
4. Service computes metrics/SHAP/governance/drift.
5. Results and audit events are saved in MongoDB.
6. Response updates frontend global state.

## Collections
- `users`
- `models`
- `datasets`
- `metrics`
- `shap_reports`
- `governance_reports`
- `drift_reports`
- `reports`
- `audit_logs`
- `chat_history`

## Indexing
Indexes are created on startup (`ensure_indexes`) for tenant, recency, and query-critical fields.

## Security
- Firebase JWT verification middleware
- CORS allowlist
- Upload type/size checks
- Chat rate limiting
- Environment-only secret usage
