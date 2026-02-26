# API Documentation

Base URL: `/api`

## Auth
Protected endpoints require:
`Authorization: Bearer <firebase_id_token>`

## System
- `GET /system/status`

## Models
- `POST /models/upload` multipart (`name`, `version`, `target_column`, `file=.pkl`)
- `GET /models`

## Datasets
- `POST /datasets/upload` multipart (`name`, `version`, `file=.csv`)
- `GET /datasets`

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
- `401` auth token invalid/expired
- `404` resource not found
- `429` rate limit exceeded
- `500` unhandled server error
