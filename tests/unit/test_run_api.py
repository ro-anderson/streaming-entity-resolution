import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import create_app
from app.dependencies import get_run_files
from app.repositories.run_files import RunFiles

SIGNAL = {
    "id": "s_001",
    "source": "slack",
    "occurred_at": "2026-09-01T13:02:00Z",
    "channel": "#comercial",
    "author": {"name": "Pedro Nogueira", "email": "pedro.nogueira@caravela.io"},
    "text": "Fechei a call com a Translog hoje.",
}


def client_for(*, out_dir: Path, signals_path: Path) -> TestClient:
    app = create_app()
    files = RunFiles(out_dir=out_dir, signals_path=signals_path)
    app.dependency_overrides[get_run_files] = lambda: files
    return TestClient(app)


def test_lists_signals_and_entities_from_files(tmp_path: Path) -> None:
    signals_path = tmp_path / "signals.jsonl"
    signals_path.write_text(json.dumps(SIGNAL) + "\n", encoding="utf-8")
    entity = {
        "id": "e_001",
        "kind": "ORGANIZATION",
        "name": "Translog",
        "aliases": [],
        "emails": [],
        "description": "Cliente.",
        "mentions": [{"signal_id": "s_001", "surface": "Translog"}],
        "revisions": [],
    }
    (tmp_path / "entities.json").write_text(json.dumps([entity]), encoding="utf-8")
    client = client_for(out_dir=tmp_path, signals_path=signals_path)
    assert [signal["id"] for signal in client.get("/api/signals").json()] == ["s_001"]
    assert client.get("/api/entities").json() == [entity]


def test_missing_run_output_is_a_problem_404(tmp_path: Path) -> None:
    client = client_for(out_dir=tmp_path, signals_path=tmp_path / "signals.jsonl")
    response = client.get("/api/trace")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["code"] == "RUN_NOT_FOUND"
