from typing import Protocol

from app.types.decision import ReviewItem


class ReviewRepository(Protocol):
    def add(self, *, item: ReviewItem) -> None: ...

    def all(self) -> list[ReviewItem]: ...
