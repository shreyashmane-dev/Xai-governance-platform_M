# AI Model Trust & Explainability Platform

Production-grade SaaS starter for model trust, explainability, governance, and drift monitoring.

## Tech Stack

- Frontend: React + Vite + TailwindCSS + Framer Motion + Recharts + React Router + React Joyride + Axios
- Backend: FastAPI + Pydantic + Motor + scikit-learn + SHAP + OpenAI API proxy
- Auth: Firebase Authentication (JWT verification in backend)
- Database: MongoDB Atlas

## Monorepo Structure

- `frontend/` React application
- `backend/` FastAPI APIs and ML analysis services
- `backend-node/` Express gateway (memory-only file intake, result persistence)
- `ml-service/` FastAPI microservice for in-memory model+dataset evaluation
- `docs/` product and engineering documentation
- `docker-compose.yml` local container orchestration

## Environment Variables

Required backend variables:

- `MONGODB_URI`
- `OPENAI_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`

Additional:

- `MONGO_DB_NAME`
- `BACKEND_CORS_ORIGINS`
- `MAX_UPLOAD_MB` (recommended `50` on Render)
- `STRICT_FEATURE_COMPATIBILITY` (`true` recommended)
- Local storage is used for artifacts in `UPLOAD_DIR`.

Frontend uses:

- `VITE_API_URL`
- `VITE_API_BASE_URL`
- Firebase web SDK keys

See `.env.example`, `backend/.env.example`, `frontend/.env.example`.

## Quick Start (Local)

1. Backend

```bash
cd backend
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

2. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

### Windows Python Note

- If your default `python` is `3.14`, do **not** use it for backend setup in this repo.
- Use `backend\.venv\Scripts\python.exe` (Python 3.11) for backend commands.

## Docker

```bash
docker compose up --build
```

## Core Modules

- Model upload and registry
- Dataset upload and preview
- In-memory model+dataset evaluation (`/api/evaluate`) with no file persistence
- Metrics engine (accuracy/precision/recall/f1/auc/confusion matrix)
- SHAP explainability engine
- Governance and trust scoring
- Drift monitor and alerts
- AI assistant (OpenAI via backend)
- Reports center and audit logging

## Security Notes

- Never hardcode credentials.
- Use platform secrets for deployment.
- Backend verifies Firebase JWT for all protected routes.

## Documentation

- `docs/INSTALLATION_GUIDE.md`
- `docs/USER_MANUAL.md`
- `docs/ADMIN_MANUAL.md`
- `docs/API_DOCUMENTATION.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/FEATURE_BREAKDOWN.md`
- `docs/ABOUT_US.md`
- `docs/TROUBLESHOOTING.md`
- `docs/LIMITATIONS.md`
- `docs/FUTURE_SCOPE.md`
- `docs/DEMO_SCRIPT.md`
