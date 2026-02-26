# Installation Guide

## Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB Atlas cluster
- Firebase project with Auth enabled

## 1. Clone and Configure
- Copy env templates:
  - `.env.example` -> `.env` (reference only)
  - `backend/.env.example` -> `backend/.env`
  - `frontend/.env.example` -> `frontend/.env`

## 2. Backend Setup
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 4. Docker Setup
```bash
docker compose up --build
```

## 5. MongoDB Atlas
- Create cluster and database user.
- Add deployment IP allowlist.
- Set SRV string in `MONGODB_URI`.

## 6. Firebase Setup
- Enable Email/Password (or SSO) in Firebase Auth.
- Create service account and map:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_CLIENT_EMAIL`
- Configure frontend Firebase web config vars.

## Troubleshooting
- `401`: verify Firebase project IDs match frontend and backend.
- DB connection errors: verify Atlas network and credentials.
- Upload issues: check file size and allowed extension.
