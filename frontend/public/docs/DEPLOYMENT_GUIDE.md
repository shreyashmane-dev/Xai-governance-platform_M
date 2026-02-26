# Deployment Guide (Render / Railway)

## Render
1. Create two services from repo:
   - `backend` (Docker)
   - `frontend` (Docker)
2. Backend env vars:
   - `MONGODB_URI`
   - `MONGO_DB_NAME`
   - `OPENAI_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `BACKEND_CORS_ORIGINS`
   - `MAX_UPLOAD_MB=50`
   - `STRICT_FEATURE_COMPATIBILITY=true`
   - `UPLOAD_DIR=uploads` (local artifact storage)
3. Frontend env vars:
   - `VITE_API_URL` (example: `https://xai-governance-platform-vnhj.onrender.com`)
   - `VITE_API_BASE_URL`
   - Firebase web vars
4. Health check path: `/healthz`

## Railway
1. Provision backend and frontend services.
2. Use Dockerfile for each service.
3. Set required variables in Railway Variables UI.
4. Attach custom domain and enforce HTTPS.

## Production Checklist
- [ ] Secrets stored in platform secret manager
- [ ] CORS restricted to production frontend domain
- [ ] Atlas network/IP policy configured
- [ ] Firebase project set to production
- [ ] Monitoring/alerts configured for API errors and latency
- [ ] Backup/retention policy documented
- [ ] Pen-test and dependency vulnerability scan run
