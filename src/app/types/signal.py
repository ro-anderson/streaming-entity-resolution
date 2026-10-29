from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Contact(BaseModel):
    name: str
    email: str | None


class Utterance(BaseModel):
    speaker: str
    t_ms: int
    text: str


class Signal(BaseModel):
    id: str
    source: Literal["slack", "meeting"]
    occurred_at: datetime
    channel: str | None = None
    author: Contact | None = None
    text: str | None = None
    title: str | None = None
    participants: list[Contact] = []
    utterances: list[Utterance] = []


class Tenant(BaseModel):
    name: str
    description: str
    language: str
    domains: list[str]
