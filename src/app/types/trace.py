from typing import Literal

from pydantic import BaseModel

from app.types.decision import CandidateDecision
from app.types.entity import Entity, EntityKind
from app.types.observation import SurfaceSource


class TraceSurface(BaseModel):
    surface: str
    source: SurfaceSource


class TraceCandidate(BaseModel):
    id: str
    name: str
    score: float
    removed_by: Literal["email", "org_id"] | None


class TraceEvent(BaseModel):
    signal_id: str
    kind: EntityKind
    name: str
    surfaces: list[TraceSurface]
    email: str | None
    org_id: str | None
    exact_match: Literal["email", "domain"] | None
    candidates: list[TraceCandidate]
    decision: CandidateDecision | None
    outcome: Literal["created", "updated", "review"]
    reason: str | None
    entity_id: str | None
    before: Entity | None
    after: Entity | None
