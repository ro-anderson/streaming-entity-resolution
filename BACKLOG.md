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
| Kibana | Debugging aid, not needed to produce the output. |
| HTTP API and frontend | They come together, when there is a UI to serve. |
| Labeled expected cases to calibrate the 0.85 threshold | The threshold is a conservative guess; `make check` covers only the critical invariants. |
| Unit tests for services beyond normalization and decision rules | Added after the first end-to-end run, guided by its result. |
| Full mypy strict in CI | It runs in `make lint` without blocking. |
