from typing import Literal

from pydantic import BaseModel

EntityKind = Literal["PERSON", "ORGANIZATION"]


class Mention(BaseModel):
    signal_id: str
    surface: str


class Revision(BaseModel):
    signal_id: str
    name: str
    description: str


class Entity(BaseModel):
    id: str
    kind: EntityKind
    name: str
    aliases: list[str] = []
    emails: list[str] = []
    description: str = ""
    mentions: list[Mention] = []
    revisions: list[Revision] = []
    domains: list[str] = []
    org_id: str | None = None


class SearchHit(BaseModel):
    entity: Entity
    score: float


class EntityExport(BaseModel):
    id: str
    kind: EntityKind
    name: str
    aliases: list[str]
    emails: list[str]
    description: str
    mentions: list[Mention]
    revisions: list[Revision]
