# Frontend

A read-only React app that replays the last run of the pipeline: the signals in order, the
decision taken for each mention, and the entities as they stood after any signal. It shows
what the backend already decided and changes nothing.

Stack: React 18, TypeScript (strict), Vite, TanStack Query, React Router, Vitest. Plain CSS,
no component library.

## Run

The UI needs the read-only API, which serves the output of `make run`:

```sh
make api        # from the repo root, terminal 1: API on :8000
make ui         # from the repo root, terminal 2: http://localhost:5173
```

Vite proxies `/api` to `http://127.0.0.1:8000`.

## How data flows

```text
API  ->  api/ (one query hook per endpoint)  ->  logic/ (pure functions)  ->  pages/ + components/
```

The API returns the raw run: signals, the decision trace, the final entities and the review
list. Everything the screens show that is not in those files is computed in `logic/`, for
example the repository as it stood after signal 31, or which parts of a message to
highlight. Pages and components only render. That is why the tests live in `logic/`.

## Code map

```text
src/
├── main.tsx                    # Entry point: mounts the app
├── App.tsx                     # Query client and router
├── AppRoutes.tsx               # Routes: /replay, /review, /entities, /entities/:id
├── styles.css                  # Design tokens and every style
├── api/
│   ├── client.ts               # Typed fetch client (openapi-fetch)
│   ├── signals.ts, trace.ts,   # One TanStack Query hook per endpoint
│   │   entities.ts, reviews.ts
│   └── schema.gen.ts           # Types generated from ../openapi.json (never edit)
├── logic/                      # Pure functions, unit tested
│   ├── repository.ts           # Entities as they stood after a given signal
│   ├── highlight.ts            # Which text to highlight, longest first, no overlap
│   ├── selection.ts            # Which trace event to show first for a signal
│   ├── entityList.ts           # Entities page: filter by kind, search, alphabetical order
│   ├── entityView.ts           # Entity page: organization, mention sources, protected homonyms
│   ├── review.ts               # Review reasons as labels
│   ├── format.ts               # Dates, scores and labels
│   └── fixtures.ts             # Test data builders
├── components/
│   ├── Layout.tsx              # Header and navigation
│   ├── ReplayControls.tsx      # Play, pause, previous, next, speed
│   ├── SignalList.tsx          # Left column of the replay
│   ├── SignalBody.tsx          # A message or a meeting, with highlights
│   ├── TracePanel.tsx          # The four resolution steps for one mention
│   ├── RepositoryPanel.tsx     # Right column: entities after the signal
│   └── HighlightedText.tsx, SearchBox.tsx, StatusMessage.tsx, Icons.tsx
└── pages/
    ├── ReplayPage.tsx          # /replay?s=s_031
    ├── ReviewPage.tsx          # /review
    ├── EntitiesPage.tsx        # /entities?kind=PERSON&q=pedro
    └── EntityPage.tsx          # /entities/e_003
```

## Commands

From `frontend/`:

```sh
pnpm install
pnpm dev            # same as `make ui`
pnpm test           # Vitest, the logic/ tests
pnpm lint           # ESLint and Prettier check
pnpm format         # Prettier write
pnpm typecheck      # tsc; Vite does not check types
pnpm build
```

When the API changes, regenerate the types and commit both files:

```sh
uv run python -m app.openapi_dump   # from the repo root: rewrites openapi.json
pnpm api:generate                   # from frontend/: rewrites src/api/schema.gen.ts
```

CI checks that `openapi.json` matches the API, then runs lint, typecheck, tests and build.

## Code rules

TypeScript strict, no `any`, no `as` assertions, functions declared with `function`, one
object parameter when a function takes several, server data only through query hooks, no
comments. The full list is in [AGENTS.md](../AGENTS.md).
