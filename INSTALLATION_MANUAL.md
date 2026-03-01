# XAI Governance Platform - Installation and Run Manual

This manual covers local setup (Windows) and Docker setup.

## 1. Required Software

Install these first:

1. Git (latest)
2. Python 3.11.x (64-bit)
3. Node.js 20.x LTS (includes npm)
4. Docker Desktop (latest) - optional, only for container setup

Verify versions:

```cmd
git --version
python --version
node --version
npm --version
docker --version
```

## 2. Project Paths

Repo root used below:

`C:\Users\Aarush\Documents\Anos\Xai-governance-platform`

## 3. Environment Files

### Backend env

Create/copy backend env:

```cmd
cd C:\Users\Aarush\Documents\Anos\Xai-governance-platform\backend
copy .env.example .env
```

Minimum required variables in `backend/.env`:

- `ENVIRONMENT=development`
- `MONGODB_URI=...`
- `MONGO_DB_NAME=xai_platform`
- `OPENAI_API_KEY=...`
- `FIREBASE_PROJECT_ID=...`
- `FIREBASE_PRIVATE_KEY=...`
- `FIREBASE_CLIENT_EMAIL=...`
- `BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:5173`

### Frontend env

Create/copy frontend env:

```cmd
cd C:\Users\Aarush\Documents\Anos\Xai-governance-platform\frontend
copy .env.example .env
```

For local backend, set:

- `VITE_API_BASE_URL=http://localhost:8000/api`

## 4. Run Locally (Without Docker)

### 4.1 Backend (CMD)

```cmd
cd C:\Users\Aarush\Documents\Anos\Xai-governance-platform\backend
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4.2 Frontend (new CMD window)

```cmd
cd C:\Users\Aarush\Documents\Anos\Xai-governance-platform\frontend
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

### 4.3 Verify

- Backend health: `http://localhost:8000/health`
- System metrics API: `http://localhost:8000/api/system/metrics`
- Frontend: `http://localhost:3000`

## 5. Run with Docker (docker.yaml)

A compose file is added at repo root: `docker.yaml`.

### 5.1 Start

```cmd
cd C:\Users\Aarush\Documents\Anos\Xai-governance-platform
docker compose -f docker.yaml up --build -d
```

### 5.2 Check status

```cmd
docker compose -f docker.yaml ps
docker compose -f docker.yaml logs -f backend
docker compose -f docker.yaml logs -f frontend
```

### 5.3 Open

- Backend: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- Frontend: `http://localhost:3000`

### 5.4 Stop

```cmd
docker compose -f docker.yaml down
```

### 5.5 Stop and remove volumes

```cmd
docker compose -f docker.yaml down -v
```

## 6. Common Issues

1. `Activate.ps1` not recognized
- You are in CMD, use: `call .venv\Scripts\activate.bat`

2. Backend fails at startup with env errors
- Check `backend/.env` and ensure all required keys are present

3. Frontend cannot call backend
- Ensure `VITE_API_BASE_URL=http://localhost:8000/api`
- Ensure backend is running on port 8000

4. Docker frontend starts but API fails
- Confirm backend container is healthy and mapped to host `8000`

5. System Monitor shows zeros
- Check: `http://localhost:8000/api/system/metrics`
- Ensure `psutil` is installed in backend environment/container
