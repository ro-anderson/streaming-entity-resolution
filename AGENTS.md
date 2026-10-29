# AGENTS.md

Notes for the next agent working in this repository. Read `README.md` for the overview.

## Commands

```sh
make up              # Elasticsearch on :9200
make install         # uv sync
make run             # process data/signals.jsonl, export out/
make run-no-cache    # same, ignoring .cache/llm
make check           # invariants on out/entities.json
make api             # read-only API over data/ and out/ on :8000
make test            # unit tests
make lint            # ruff check, ruff format --check, mypy (non-blocking)
uv run pytest tests/integration   # needs Elasticsearch running
```

## Layers

```text
producers -> consumers -> services -> repositories / clients
                    types (shared)
```

| Layer | Does |
| --- | --- |
| `handlers/` | Read-only HTTP routes over the last run (`api.py`); no business logic. |
| `producers/` | Yield signals in order (`SignalProducer` Protocol). |
| `consumers/` | Handle one signal: build observations, extract, resolve organizations then people. |
| `services/` | Business rules: normalization, decision rules, extraction, resolution, entity create/update, export. |
| `repositories/` | Storage behind Protocols: Elasticsearch entities, in-memory review items. |
| `clients/` | OpenAI (with disk cache) and Elasticsearch clients. |
| `types/` | Pydantic models shared by every layer. |

## Code rules

- Type every function. Pydantic models at every boundary (signals, LLM responses, documents).
- Functions with more than one parameter take keyword-only parameters: `def f(*, a, b)`.
- No names starting with `_`. Files in `snake_case.py`.
- No comments or docstrings; record design decisions in the "Decisions" section of `README.md`.
- No emojis in code, commits or docs.
- Tests are named after the behavior they check. Write the test first for normalization and
  decision rules.
- Commits follow Conventional Commits: `type(scope): description`.
- Never edit `data/`.
