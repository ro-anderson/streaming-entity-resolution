import json
from pathlib import Path

from app.errors import AppError
from app.types.decision import ReviewItem
from app.types.entity import EntityExport
from app.types.signal import Signal
from app.types.trace import TraceEvent

RUN_NOT_FOUND = "RUN_NOT_FOUND"


def read_text(*, path: Path) -> str:
    if not path.exists():
        raise AppError(
            code=RUN_NOT_FOUND,
            status=404,
            title="Run output not found",
            detail=f"{path.name} does not exist; run `make run` first",
        )
    return path.read_text(encoding="utf-8")


def jsonl_lines(*, path: Path) -> list[str]:
    return [line for line in read_text(path=path).splitlines() if line.strip()]


class RunFiles:
    def __init__(self, *, out_dir: Path, signals_path: Path) -> None:
        self.out_dir = out_dir
        self.signals_path = signals_path

    def signals(self) -> list[Signal]:
        return [Signal.model_validate_json(line) for line in jsonl_lines(path=self.signals_path)]

    def trace(self) -> list[TraceEvent]:
        path = self.out_dir / "trace.jsonl"
        return [TraceEvent.model_validate_json(line) for line in jsonl_lines(path=path)]

    def entities(self) -> list[EntityExport]:
        items = json.loads(read_text(path=self.out_dir / "entities.json"))
        return [EntityExport.model_validate(item) for item in items]

    def reviews(self) -> list[ReviewItem]:
        items = json.loads(read_text(path=self.out_dir / "needs_review.json"))
        return [ReviewItem.model_validate(item) for item in items]
