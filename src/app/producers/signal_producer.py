from collections.abc import Iterator
from typing import Protocol

from app.types.signal import Signal


class SignalProducer(Protocol):
    def signals(self) -> Iterator[Signal]: ...
