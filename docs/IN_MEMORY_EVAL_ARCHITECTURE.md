# In-Memory Evaluation Architecture

## Goal
Run model + dataset evaluation without permanent file storage.

## Data Flow
1. Frontend collects `.csv` and `.pkl/.pickle` files in component state.
2. Frontend sends multipart request to `POST /api/evaluate` (Node gateway).
3. Node gateway accepts files via Multer `memoryStorage()`.
4. Node forwards byte buffers to Python microservice `POST /evaluate`.
5. Python computes preview, metrics, confusion matrix, fairness, and explainability.
6. Python returns JSON only.
7. Node stores only computed result document in MongoDB.
8. Node zeroes upload buffers and drops file references.
9. Frontend receives result, renders dashboard, and clears file state.

## Services
- `backend-node/`
  - `routes/evaluateRoutes.js`
  - `controllers/evaluateController.js`
  - `services/mlServiceClient.js`
  - `middleware/uploadMiddleware.js`
  - `middleware/rateLimitMiddleware.js`
  - `models/EvaluationResult.js`
- `ml-service/main.py`
  - `/evaluate` endpoint (in-memory processing only)

## Storage Rules
- Allowed to store:
  - metrics
  - fairness outputs
  - explainability outputs
  - dataset preview (first 10 rows)
  - metadata (names, target column, timestamp)
- Forbidden to store:
  - dataset raw file bytes
  - model raw file bytes
  - disk file path references

## Security Controls
- File type validation in gateway (`.csv`, `.pkl`, `.pickle` only).
- Max size limit (default 50MB).
- Endpoint rate limiting.
- Safe CSV parsing with sanitized preview output.
- `pickle` loading inside guarded `try/except`.

## Deployment Variables
- Node gateway:
  - `MONGO_URI`
  - `ML_SERVICE_URL`
  - `MAX_UPLOAD_MB`
  - `FRONTEND_ORIGIN`
- ML service:
  - `MAX_UPLOAD_MB`

