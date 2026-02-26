# 🚀 Professional DevOps Deployment Guide

This guide outlines the production deployment strategy for the **XAI Governance Platform** using Render (Backend) and Vercel (Frontend).

## 📊 Final Production Folder Structure

```text
.
├── backend/                # FastAPI Backend
│   ├── app/                # Application logic
│   ├── requirements.txt    # Python dependencies
│   ├── Procfile            # Deployment command
│   └── .env.example        # Environment template
├── frontend/               # Vite + React Frontend
│   ├── src/                # Source code
│   ├── vercel.json         # SPA routing config
│   └── .env.example        # Environment template
├── render.yaml             # Render Blueprint (Infrastructure as Code)
└── DEPLOYMENT.md           # This guide
```

---

## 🏗️ 1. Backend Deployment (Render)

We use **Infrastructure as Code (IaC)** via the `render.yaml` file.

### Step-by-Step:

1.  Go to [Render Dashboard](https://dashboard.render.com).
2.  Click **New +** -> **Blueprint**.
3.  Connect your GitHub repository.
4.  Render will automatically detect `render.yaml` and configure the service.
5.  You will be prompted to fill in the following **Environment Variables**:

| Key                     | Example/Description                               |
| ----------------------- | ------------------------------------------------- |
| `ENVIRONMENT`           | `production`                                      |
| `MONGODB_URI`           | `mongodb+srv://...`                               |
| `MONGO_DB_NAME`         | `xai_platform`                                    |
| `OPENAI_API_KEY`        | `sk-...`                                          |
| `FIREBASE_PROJECT_ID`   | `your-project-id`                                 |
| `FIREBASE_PRIVATE_KEY`  | `"-----BEGIN PRIVATE KEY-----\n..."` (Use quotes) |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-...`                           |
| `BACKEND_CORS_ORIGINS`  | `https://your-app.vercel.app`                     |

**Production Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## 🎨 2. Frontend Deployment (Vercel)

Vercel is optimized for Vite/React applications.

### Step-by-Step:

1.  Go to [Vercel Dashboard](https://vercel.com).
2.  Click **Add New** -> **Project**.
3.  Import your GitHub repository.
4.  **Configuration Settings**:
    - **Framework Preset**: `Vite`
    - **Root Directory**: `frontend`
    - **Build Command**: `npm run build`
    - \*Output Directory\*\*: `dist`
5.  **Environment Variables**:

| Key                                 | Value                                                         |
| ----------------------------------- | ------------------------------------------------------------- |
| `VITE_API_URL`                      | `https://your-backend.onrender.com/api` (Wait for Render URL) |
| `VITE_FIREBASE_API_KEY`             | `...`                                                         |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `...`                                                         |
| `VITE_FIREBASE_PROJECT_ID`          | `...`                                                         |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `...`                                                         |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `...`                                                         |
| `VITE_FIREBASE_APP_ID`              | `...`                                                         |

---

## ✅ Deployment Checklist

- [ ] **Database Access**: Ensure your MongoDB Atlas IP Access List allows connections from `0.0.0.0/0` (Render IPs are dynamic on the free tier).
- [ ] **CORS Sync**: The `BACKEND_CORS_ORIGINS` on Render must match your Vercel URL.
- [ ] **Firebase Secrets**: Ensure `FIREBASE_PRIVATE_KEY` is correctly pasted with `\n` characters preserved.
- [ ] **Health Check**: Verify backend is live at `https://your-backend.onrender.com/health`.
- [ ] **SPA Routing**: Verify that refreshing `https://your-app.vercel.app/dashboard` does not result in a 404 (handled by `vercel.json`).

---

## ⚙️ Secure Configuration

- **Free Tier Compatible**: Uses standard port mapping and standard worker threads.
- **Cold Start**: Added a `/health` endpoint so you can use techniques like "Cron jobs" (e.g., Cron-job.org) to keep the free tier awake if needed.
- **Environment Handling**: The project uses `pydantic-settings` (Backend) and `import.meta.env` (Frontend) to ensure no secrets are hardcoded.
