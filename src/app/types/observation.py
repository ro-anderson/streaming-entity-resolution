from typing import Literal

from pydantic import BaseModel

from app.types.entity import EntityKind

SurfaceSource = Literal["author", "participant", "speaker", "text"]


class ExtractedEntity(BaseModel):
    kind: EntityKind
    name: str
    surfaces: list[str]
    org_name: str | None
    domain: str | None
    role: str | None
    description: str
    changed: bool
    evidence: str


class ParticipantNote(BaseModel):
    name: str
    org_name: str | None
    role: str | None
    description: str
    changed: bool


class ExtractionResult(BaseModel):
    entities: list[ExtractedEntity]
    participants: list[ParticipantNote]


class Observation(BaseModel):
    kind: EntityKind
    name: str
    surfaces: list[str]
    email: str | None = None
    domain: str | None = None
    org_name: str | None = None
    role: str | None = None
    description: str = ""
    changed: bool = False
    evidence: str = ""
    sources: dict[str, SurfaceSource] = {}
