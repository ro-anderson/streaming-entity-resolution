from pydantic import BaseModel

from app.types.entity import EntityKind


class ExtractedEntity(BaseModel):
    kind: EntityKind
    name: str
    surfaces: list[str]
    org_name: str | None
    domain: str | None
    role: str | None
    description: str
    evidence: str


class ExtractionResult(BaseModel):
    entities: list[ExtractedEntity]


class Observation(BaseModel):
    kind: EntityKind
    name: str
    surfaces: list[str]
    email: str | None = None
    domain: str | None = None
    org_name: str | None = None
    role: str | None = None
    description: str = ""
    evidence: str = ""
