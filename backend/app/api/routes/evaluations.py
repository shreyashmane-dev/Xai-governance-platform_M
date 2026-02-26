import logging
from fastapi import APIRouter, Depends, Query
from app.core.security import verify_token
from app.db.mongo import get_db

router = APIRouter()
LOGGER = logging.getLogger(__name__)

@router.get("")
async def list_evaluations(
    limit: int = Query(20, ge=1, le=200),
    user=Depends(verify_token)
):
    """
    Fetch history of in-memory evaluations from MongoDB.
    This allows the main backend to serve history even if the 
    Node Gateway is only used for the heavy processing part.
    """
    db = get_db()
    # Mongoose model 'EvaluationResult' maps to collection 'evaluationresults'
    cursor = db.evaluationresults.find({}).sort("evaluatedAt", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    
    for row in rows:
        row["id"] = str(row.pop("_id"))
        if "evaluatedAt" in row:
            # Ensure it's serializable if it's already a datetime, 
            # or just let FastAPI handle it.
            pass
            
    return {
        "success": True, 
        "data": rows
    }
