import json
from pathlib import Path

from app.types.decision import ReviewItem
from app.types.entity import Entity, EntityExport


def export(*, entities: list[Entity], reviews: list[ReviewItem], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    public = [
        EntityExport.model_validate(entity.model_dump()).model_dump()
        for entity in sorted(entities, key=lambda entity: entity.id)
    ]
    (out_dir / "entities.json").write_text(
        json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out_dir / "needs_review.json").write_text(
        json.dumps([item.model_dump() for item in reviews], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
