# API Documentation

Base URL: `/api`

## Auth
Protected endpoints require:
`Authorization: Bearer <firebase_id_token>`

## System
- `GET /system/status`

## Models
- `POST /models/upload` multipart (`name|modelName`, `version`, `target_column`, `file|model=.pkl`)
- `GET /models`
- `GET /models/{model_id}/result-summary`
 - `GET /models/{model_id}/compatibility/{dataset_id}`
  - Upload persists artifacts in local server storage.

## Datasets
- `POST /datasets/upload` multipart (`name`, `version`, `file=.csv`)
- `GET /datasets`
- `GET /datasets/{dataset_id}/preview?limit=10`

## Analytics
- `POST /analytics/metrics?model_id=&dataset_id=`
- `POST /analytics/shap?model_id=&dataset_id=`
- `GET /analytics/summary`

## Governance
- `POST /governance/analyze?model_id=&dataset_id=&sensitive_column=`

## Drift
- `POST /drift/analyze?baseline_dataset_id=&current_dataset_id=`

## Reports
- `POST /reports/generate?model_id=&dataset_id=`
- `GET /reports`

## Chat
- `POST /chat`
```json
{
  "session_id": "default",
  "message": "Explain trust drop",
  "context": {
    "metrics": {},
    "shapSummary": {},
    "biasSummary": {},
    "driftSummary": {},
    "trustScore": 72
  }
}
```

## Error Codes
- `400` invalid payload/schema
- `400` model/dataset feature mismatch when `STRICT_FEATURE_COMPATIBILITY=true`
- `401` auth token invalid/expired
- `404` resource not found
- `429` rate limit exceeded
- `500` unhandled server error
