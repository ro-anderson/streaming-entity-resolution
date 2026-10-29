from pathlib import Path

from app.clients.disk_cache import DiskCache


def test_cache_roundtrip(tmp_path: Path) -> None:
    cache = DiskCache(directory=tmp_path / "cache", enabled=True)
    key = cache.key(parts=["a", "b"])
    assert cache.get(key=key) is None
    cache.put(key=key, value='{"x": 1}')
    assert cache.get(key=key) == '{"x": 1}'


def test_cache_ignores_reads_when_disabled_but_still_writes(tmp_path: Path) -> None:
    disabled = DiskCache(directory=tmp_path, enabled=False)
    key = disabled.key(parts=["a"])
    disabled.put(key=key, value="fresh")
    assert disabled.get(key=key) is None
    enabled = DiskCache(directory=tmp_path, enabled=True)
    assert enabled.get(key=key) == "fresh"


def test_cache_key_changes_with_any_part(tmp_path: Path) -> None:
    cache = DiskCache(directory=tmp_path, enabled=True)
    base = cache.key(parts=["a", "b", "c"])
    assert cache.key(parts=["a", "b", "c"]) == base
    assert cache.key(parts=["x", "b", "c"]) != base
    assert cache.key(parts=["a", "b", "x"]) != base
    assert cache.key(parts=["ab", "c"]) != cache.key(parts=["a", "bc"])
