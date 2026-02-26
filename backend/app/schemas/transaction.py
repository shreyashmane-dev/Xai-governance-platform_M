from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class TransactionBase(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(default="USD")
    merchant_name: str
    merchant_category: str
    location_lat: Optional[float] = None
    location_long: Optional[float] = None
    device_id: Optional[str] = None
    ip_address: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionRecord(TransactionBase):
    id: str
    user_id: str
    tenant_id: str
    timestamp: datetime
    fraud_score: Optional[float] = None
    is_flagged: bool = False
    status: str = "pending" # pending, approved, blocked

class FraudAssessment(BaseModel):
    transaction_id: str
    probability: float
    risk_level: str # low, medium, high
    reasoning: str
    features_contribution: Dict[str, float]
    processed_at: datetime
