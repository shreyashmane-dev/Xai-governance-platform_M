# Troubleshooting

## 1) ERR_CONNECTION_REFUSED (localhost:8000)
Backend is not running.

Run:
```powershell
cd backend
C:\Users\OMPRASAD\AI-Smart-IDS\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 2) CORS blocked from 127.0.0.1:5174
Ensure backend `.env` has:
`BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174`

Restart backend after changes.

## 3) Metrics returns HTTP 400
Likely target column mismatch.
- Upload model with correct `target_column`
- Ensure selected dataset contains that column

## 4) Drift returns HTTP 400
Datasets may not share usable columns.
- Ensure both datasets have common schema
- Include numeric or categorical columns

## 5) SHAP not available
If SHAP wheel is unavailable in Python 3.14, fallback explainability is used (`method: model_importance_fallback`).

## 6) Firebase login 400
- Verify frontend Firebase env values
- Enable Email/Password provider
- Use valid credentials
