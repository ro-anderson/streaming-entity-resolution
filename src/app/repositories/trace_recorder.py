from pathlib import Path
from typing import Protocol

from app.types.trace import TraceEvent


class TraceRecorder(Protocol):
    def record(self, *, event: TraceEvent) -> None: ...


class JsonlTraceRecorder:
    def __init__(self, *, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("", encoding="utf-8")

    def record(self, *, event: TraceEvent) -> None:
        with self.path.open("a", encoding="utf-8") as lines:
            lines.write(event.model_dump_json() + "\n")
