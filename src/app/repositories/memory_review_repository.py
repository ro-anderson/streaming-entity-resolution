from app.types.decision import ReviewItem


class MemoryReviewRepository:
    def __init__(self) -> None:
        self.items: list[ReviewItem] = []

    def add(self, *, item: ReviewItem) -> None:
        if item not in self.items:
            self.items.append(item)

    def all(self) -> list[ReviewItem]:
        return list(self.items)
