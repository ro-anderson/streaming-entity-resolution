# Backlog

Items left out of the first version, and why.

| Item | Why it is not in v1 |
| --- | --- |
| Infer who "Speaker N" is and fix utterances attributed to the wrong speaker | Under-attributing is safer than merging wrongly; unnamed speakers go to review for now. |
| kNN on name + description embeddings, fused with lexical search by RRF in the client | New entities start with short descriptions, so embeddings help little at first. Use `text-embedding-3-small` from our own client, not inference inside Elasticsearch. |
| RRF tests | They come with kNN. |
| Native Elasticsearch RRF retriever | Depends on version and license; RRF in the client is easier to reason about. |
| SNS, SQS FIFO, DynamoDB single table + CDC with LocalStack | The architecture is already visible in the producer/consumer abstractions; infrastructure can be plugged in later. |
| Elasticsearch service container and integration tests in CI | v1 CI runs ruff and unit tests only. |
| End-to-end UI tests (Playwright) over a recorded run | The UI logic is unit tested; a browser test needs a fixed run output committed as a fixture. |
| Kibana | Debugging aid, not needed to produce the output. |
| Manual review with persistence | The UI is read-only in v1. Elasticsearch is recreated on every run, so manual decisions need their own file (for example `data/manual_decisions.json`) that is reapplied after the reset. |
| Live run streamed to the UI (SSE) | The UI replays a recorded run, which is instant and does not depend on the network or the LLM during a demo. |
| Threshold calibration on real boundary cases | See below. The 0.85 cut sits between the confidence values the model actually emits; `make check` covers only the critical invariants. |
| Better descriptions from participant notes | Some come out as "author of the message" instead of the person's role. Fixing it changes the extraction prompt, which invalidates the cache and costs a full run. |
| Unit tests for services beyond normalization and decision rules | Added after the first end-to-end run, guided by its result. |
| Full mypy strict in CI | It runs in `make lint` without blocking. |

## Threshold calibration on real boundary cases

The LLM confidence is not continuous: in practice the model answers in a few round values
(0.95, 0.9, 0.85, 0.8, 0.7), so it behaves like categories, and the 0.85 cut sits between
the 0.9 and 0.8 groups. The Elasticsearch BM25 score is not normalized across queries and
should not be thresholded; it only ranks candidates (the chosen one was first in 83 of 86
matches in the first run).

Proposed mechanism:

1. From `out/trace.jsonl`, select the boundary decisions: `match` with confidence between
   0.70 and 0.85, and every `ambiguous`.
2. Render each case for a human with the signal excerpt, the candidates, the LLM answer and,
   to give the labeler the whole picture, a "who is who" built only from structured fields
   (emails, authors, participants) and the other signals where each candidate appears.
3. A human marks the right target, `new` or `unsure`.
4. For each threshold and each kind (PERSON, ORGANIZATION), report accepted merges, correct,
   wrong and correct merges lost. Pick the lowest threshold with zero wrong merges.

The threshold is applied after the LLM answer, so recalibrating never invalidates the cache.
A likely outcome is a lower threshold for organizations (transcription variants such as
"Translogue") while people stay at 0.85.
