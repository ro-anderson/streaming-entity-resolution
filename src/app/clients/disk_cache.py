import hashlib
import json
from pathlib import Path


class DiskCache:
    def __init__(self, *, directory: Path, enabled: bool) -> None:
        self.directory = directory
        self.enabled = enabled

    def key(self, *, parts: list[str]) -> str:
        return hashlib.sha256(json.dumps(parts).encode("utf-8")).hexdigest()

    def path_for(self, *, key: str) -> Path:
        return self.directory / f"{key}.json"

    def get(self, *, key: str) -> str | None:
        if not self.enabled:
            return None
        path = self.path_for(key=key)
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    def put(self, *, key: str, value: str) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path_for(key=key).write_text(value, encoding="utf-8")
