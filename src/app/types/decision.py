from typing import Literal

from pydantic import BaseModel


class CandidateDecision(BaseModel):
    decision: Literal["match", "new", "ambiguous"]
    candidate_id: str | None
    confidence: float
    reason: str
    description: str
    name: str | None


class ReviewItem(BaseModel):
    signal_id: str
    surface: str
    reason: str
