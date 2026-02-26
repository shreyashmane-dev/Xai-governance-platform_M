from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List
from datetime import datetime
from bson import ObjectId

from app.core.security import verify_token
from app.db.mongo import get_db
from app.schemas.transaction import TransactionCreate, TransactionRecord, FraudAssessment
from app.services.fraud_service import fraud_engine
from app.utils.audit import write_audit
from app.utils.time_utils import utc_now

router = APIRouter()

@router.post("/transactions", response_model=TransactionRecord)
async def create_transaction(
    payload: TransactionCreate,
    user=Depends(verify_token)
):
    """
    Submits a new transaction, runs real-time fraud analysis, and stores results.
    """
    db = get_db()
    tenant_id = user["tenant_id"]
    user_id = user["uid"]

    # 1. Run Fraud ML Engine
    analysis = await fraud_engine.analyze_transaction(payload.model_dump())
    
    # 2. Determine initial status
    status = "approved"
    if analysis["risk_level"] == "high":
        status = "blocked"
    elif analysis["risk_level"] == "medium":
        status = "flagged"

    # 3. Store in Database
    doc = {
        **payload.model_dump(),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "timestamp": utc_now(),
        "fraud_score": analysis["probability"],
        "is_flagged": status != "approved",
        "status": status,
        "fraud_details": analysis
    }
    
    result = await db.transactions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    
    # 4. Audit Trail
    await write_audit(
        db, 
        tenant_id, 
        user_id, 
        "transaction_created", 
        "transaction", 
        doc["id"], 
        {"amount": payload.amount, "fraud_score": analysis["probability"]}
    )

    return doc

@router.get("/transactions", response_model=List[TransactionRecord])
async def list_transactions(
    limit: int = 50,
    user=Depends(verify_token)
):
    """
    Returns verified transaction history for the authenticated tenant/user.
    """
    db = get_db()
    query = {"tenant_id": user["tenant_id"]}
    
    # If not admin, only show own transactions
    if user["claims"].get("role") != "admin":
        query["user_id"] = user["uid"]

    rows = await db.transactions.find(query).sort("timestamp", -1).to_list(limit)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    
    return rows

@router.get("/stats")
async def get_fraud_stats(user=Depends(verify_token)):
    """
    Dashboard analytics for fraud trends.
    """
    db = get_db()
    tenant_id = user["tenant_id"]
    
    # Basic aggregation simulation
    total = await db.transactions.count_documents({"tenant_id": tenant_id})
    flagged = await db.transactions.count_documents({"tenant_id": tenant_id, "is_flagged": True})
    blocked = await db.transactions.count_documents({"tenant_id": tenant_id, "status": "blocked"})
    
    return {
        "summary": {
            "total_count": total,
            "flagged_count": flagged,
            "blocked_count": blocked,
            "fraud_prevention_rate": round(((total - flagged) / max(total, 1)) * 100, 2)
        }
    }
