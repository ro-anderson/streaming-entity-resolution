from fastapi import APIRouter

from app.dependencies import RunFilesDep
from app.types.decision import ReviewItem
from app.types.entity import EntityExport
from app.types.signal import Signal
from app.types.trace import TraceEvent

router = APIRouter(prefix="/api", tags=["run"])


@router.get("/signals")
def list_signals(files: RunFilesDep) -> list[Signal]:
    return files.signals()


@router.get("/trace")
def list_trace(files: RunFilesDep) -> list[TraceEvent]:
    return files.trace()


@router.get("/entities")
def list_entities(files: RunFilesDep) -> list[EntityExport]:
    return files.entities()


@router.get("/reviews")
def list_reviews(files: RunFilesDep) -> list[ReviewItem]:
    return files.reviews()
