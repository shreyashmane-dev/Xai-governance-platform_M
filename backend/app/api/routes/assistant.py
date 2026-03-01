from time import perf_counter

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.security import verify_token
from app.db.mongo import get_db
from app.services.assistant_service import build_assistant_context, generate_assistant_answer
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()


class AssistantChatRequest(BaseModel):
    model_id: str = Field(min_length=1)
    dataset_id: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=4000)


@router.post("/chat")
async def assistant_chat(payload: AssistantChatRequest, user=Depends(verify_token)):
    db = get_db()
    started = perf_counter()

    context = await build_assistant_context(db, user["tenant_id"], payload.model_id, payload.dataset_id)
    answer, used_fallback = generate_assistant_answer(payload.message, context)
    latency_ms = int((perf_counter() - started) * 1000)

    await db.chat_history.insert_one(
        {
            "tenant_id": user["tenant_id"],
            "user_id": user["uid"],
            "session_id": f"{payload.model_id}:{payload.dataset_id}",
            "model_id": payload.model_id,
            "dataset_id": payload.dataset_id,
            "request": payload.message,
            "response": answer,
            "context_snapshot": context,
            "latency_ms": latency_ms,
            "used_fallback": used_fallback,
            "created_at": utc_now(),
        }
    )
    await write_audit(
        db,
        user["tenant_id"],
        user["uid"],
        "assistant_chat",
        "assistant_session",
        f"{payload.model_id}:{payload.dataset_id}",
        {"latency_ms": latency_ms, "used_fallback": used_fallback},
    )

    return {
        "success": True,
        "data": {
            "message": answer,
            "latency_ms": latency_ms,
            "used_fallback": used_fallback,
            "response_type": "full_model_report" if "MODEL ANALYSIS REPORT" in answer else "short_answer",
            "model": context["model"],
            "dataset": context["dataset"],
            "metrics": context["metrics"],
        },
    }


@router.get("/history")
async def assistant_history(
    model_id: str = Query(""),
    dataset_id: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(verify_token),
):
    db = get_db()
    query = {"tenant_id": user["tenant_id"]}
    if model_id:
        query["model_id"] = model_id
    if dataset_id:
        query["dataset_id"] = dataset_id

    rows = await db.chat_history.find(query).sort("created_at", -1).to_list(limit)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return {"success": True, "data": rows}
