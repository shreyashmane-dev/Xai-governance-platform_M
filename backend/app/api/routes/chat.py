from collections import defaultdict, deque
from datetime import datetime, timezone
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI

from app.core.config import settings
from app.core.security import verify_token
from app.db.mongo import get_db
from app.schemas.common import ChatRequest
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()
_client = OpenAI(api_key=settings.openai_api_key)
_rate_limiter: dict[str, deque] = defaultdict(deque)

SYSTEM_PROMPT = """
You are an enterprise AI governance assistant.
Use only context provided by the backend.
If data is missing, explicitly say what is missing.
Never fabricate metrics or risk values.
Output:
1) Direct answer
2) Evidence bullets (metrics/shap/bias/drift/trust)
3) Recommended actions (prioritized, concrete)
4) Risk statement
5) Confidence (Low/Medium/High) with reason
""".strip()


def _allowed(uid: str) -> bool:
    now = datetime.now(timezone.utc)
    dq = _rate_limiter[uid]
    while dq and (now - dq[0]).total_seconds() > settings.chat_rate_window_seconds:
        dq.popleft()
    if len(dq) >= settings.chat_rate_limit:
        return False
    dq.append(now)
    return True


def fallback_answer(ctx: dict) -> str:
    trust = ctx.get("trustScore")
    drift = ctx.get("driftSummary", {}) or {}
    alert_count = drift.get("alert_count", 0)

    if trust is None:
        return (
            "1) Direct answer: Trust score is unavailable.\n"
            "2) Evidence: Governance/trust data not found in request context.\n"
            "3) Recommended actions: Run metrics -> SHAP -> governance -> drift, then request trust score.\n"
            "4) Risk statement: Unassessed risk due to missing evidence.\n"
            "5) Confidence: Medium (based on missing context signals)."
        )
    if trust < 60:
        return (
            f"1) Direct answer: High risk posture (trust score {trust}).\n"
            f"2) Evidence: Drift alerts={alert_count}, trust below 60.\n"
            "3) Recommended actions: (a) retrain with recent data (b) bias mitigation by subgroup (c) tighten drift thresholds.\n"
            "4) Risk statement: Elevated governance and performance degradation risk.\n"
            "5) Confidence: High (directly supported by trust and drift inputs)."
        )
    if trust < 80:
        return (
            f"1) Direct answer: Moderate risk posture (trust score {trust}).\n"
            f"2) Evidence: Drift alerts={alert_count}, trust in 60-79 band.\n"
            "3) Recommended actions: (a) monitor top SHAP drivers weekly (b) audit subgroup metrics (c) set retraining trigger.\n"
            "4) Risk statement: Manageable risk with active monitoring.\n"
            "5) Confidence: High (score-driven assessment)."
        )
    return (
        f"1) Direct answer: Healthy posture (trust score {trust}).\n"
        f"2) Evidence: Low drift pressure with alerts={alert_count} and trust>=80.\n"
        "3) Recommended actions: Maintain monitoring cadence, preserve audit trail, run monthly fairness review.\n"
        "4) Risk statement: Low current operational risk.\n"
        "5) Confidence: High (consistent indicators)."
    )


@router.post("")
async def chat(payload: ChatRequest, user=Depends(verify_token)):
    if not _allowed(user["uid"]):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    prompt = (
        f"User message: {payload.message}\n\n"
        f"Metrics: {payload.context.metrics}\n"
        f"SHAP: {payload.context.shapSummary}\n"
        f"Bias: {payload.context.biasSummary}\n"
        f"Drift: {payload.context.driftSummary}\n"
        f"Trust Score: {payload.context.trustScore}"
    )

    started = perf_counter()
    text = ""
    used_fallback = False
    try:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        )
        text = response.choices[0].message.content or ""
    except Exception:
        used_fallback = True
        text = fallback_answer(payload.context.model_dump())

    latency_ms = int((perf_counter() - started) * 1000)
    db = get_db()
    await db.chat_history.insert_one(
        {
            "tenant_id": user["tenant_id"],
            "user_id": user["uid"],
            "session_id": payload.session_id,
            "request": payload.message,
            "response": text,
            "context_snapshot": payload.context.model_dump(),
            "latency_ms": latency_ms,
            "used_fallback": used_fallback,
            "created_at": utc_now(),
        }
    )
    await write_audit(
        db,
        user["tenant_id"],
        user["uid"],
        "chat_request",
        "chat_session",
        payload.session_id,
        {"latency_ms": latency_ms, "used_fallback": used_fallback},
    )

    return {"success": True, "data": {"message": text, "latency_ms": latency_ms, "used_fallback": used_fallback}}


@router.get("")
async def chat_route_info():
    return {
        "success": True,
        "detail": "Chat endpoint is available. Use POST with JSON payload to receive a response.",
        "method": "POST",
        "path": "/api/chat",
    }
