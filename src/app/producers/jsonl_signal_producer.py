from collections.abc import Iterator
from pathlib import Path

from app.types.signal import Signal


class JsonlSignalProducer:
    def __init__(self, *, path: Path) -> None:
        self.path = path

    def signals(self) -> Iterator[Signal]:
        previous: Signal | None = None
        with self.path.open(encoding="utf-8") as lines:
            for line in lines:
                if not line.strip():
                    continue
                signal = Signal.model_validate_json(line)
                if previous is not None and signal.occurred_at < previous.occurred_at:
                    message = f"{signal.id} arrived before {previous.id}"
                    raise ValueError(message)
                previous = signal
                yield signal
