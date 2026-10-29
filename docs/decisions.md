# Decisions

Why the pipeline behaves the way it does. Each section is one decision, with the reason
behind it.

- [Guiding principle](#guiding-principle)
- [Identity and matching](#identity-and-matching)
- [Creating entities](#creating-entities)
- [Names, aliases and mentions](#names-aliases-and-mentions)
- [Search](#search)
- [Match threshold](#match-threshold)
- [LLM usage](#llm-usage)
- [Storage](#storage)
- [Interface](#interface)

## Guiding principle

**Splitting is cheap, merging is expensive.** Two records for one person can be joined
later; two people merged into one record corrupt everything built on it. Every uncertain
path ends in review, never in a merge.

## Identity and matching

### Exact match first

- A person resolves without search or LLM when their email is already known.
- An organization resolves the same way when the email domain of a participant is already
  linked to it.

### Domain resolves organizations, not people

For a person, the email domain only tells which organization they belong to (`org_id`).
When the LLM links a participant's domain to an organization, the domain is stored on it, so
the next email from that domain resolves without the LLM. Personal domains (gmail, outlook,
...) are never linked to an organization.

### Two hard guards, and nothing more

A candidate is dropped before the LLM sees it when:

1. both sides have emails and they differ, or
2. both sides have an organization and they differ.

The organization guard applies only to the search + LLM path. An exact email match
overrides it, so a person who changes companies is updated instead of blocked forever.

### Participation is evidence, not proof

Being the author or a participant of a signal is passed to the LLM as context, never used
as a shortcut: in a meeting with both Pedros, a speaker called "Pedro" cannot inherit either
email.

### Speakers inherit a participant's email only on an identical full name

The comparison is on the normalized full name (two or more tokens). A first name alone
never links a speaker to a participant.

## Creating entities

### Anchor rule

A new person needs at least one of: an email, a name with two or more tokens, an
organization or a role. A bare first name with nothing else goes to review.

### Ambiguity with an email creates

An ambiguous decision about someone who has an email creates a new entity instead of going
to review. The email is a strong identity of its own: "Rafael Teixeira", author with an
email, is not left without a record just because a nickname-only "Rafa" exists. Without an
email, ambiguous still goes to review.

### Unnamed speakers go to review

"Speaker 3" is never guessed. Inferring who it is from the invite and the content is in the
[backlog](backlog.md).

### Organizations are resolved before people in each signal

So "Carlos, from Translog" can be linked to a Translog record created moments earlier in
the same signal.

## Names, aliases and mentions

### A surface is the exact text from the signal

The LLM may return a surface with different case or accents ("rodobras"). It is accepted
only if it occurs in the signal, compared without case and accents, and what is stored is
the original span.

### Surfaces are trimmed to the name

The LLM sometimes returns a whole phrase that does occur in the text ("volto com isso até
sexta"). Each surface is cut to the span between the first and last token compatible with
the entity name, and dropped when it has none. A token is compatible when it is equal to a
name token, a prefix of one ("Mari", "trans log"), or one letter away from one ("vector",
"luís"). A single letter counts only next to a compatible token, so "Carlos M." keeps the
initial but a stray "a" does not keep a sentence.

### Mentions from structured fields keep the field value

Author, participant and speaker mentions use the name exactly as it came in the field.

### Aliases drop a leading article

"O Carlos" is stored as the alias "Carlos". The mention keeps the exact surface.

### People: the name changes only by expansion

A person's name changes when each token of the current name is a prefix of a token of the
new one and the new one adds tokens ("Jo" to "Joana Prates", "Rafa" to "Rafael Teixeira"),
or when the current token is an initial ("Carlos M." to "Carlos Menezes"). Otherwise the new
form becomes an alias, so "Translog" is never renamed to the misheard "Translogue", and
"Bia" and "Beatriz" stay as name and alias.

### Organizations: the LLM picks the spelling among the known ones

The first mention of an organization may be a transcription error ("cargo fai"). On a
match, the decision also returns the correct spelling, and it is accepted only if it is one
of the forms already seen: the current name, an alias or a surface of the mention. The LLM
can choose "Cargofy" over "CargoFai", but cannot invent a name.

### Revisions only on change

Creation always writes a revision. An update writes one only when the name or the
description changed. The seeded tenant organization has none, since it does not come from
a signal.

## Search

### Lexical first

Fuzzy `multi_match` on name and aliases catches transcription errors, an edge n-gram
subfield catches nicknames by prefix, and ASCII folding makes "Rodobras" find "Rodobrás".
Freshly created entities have one-line descriptions, so embeddings would add little at
first; kNN with RRF is in the [backlog](backlog.md). `more_like_this` was discarded: names
are too short for term statistics.

### Top 5 candidates of the same kind

People and organizations live in separate indices, so a search never crosses kinds. In the
first run the chosen candidate was first in 83 of 86 matches.

## Match threshold

A merge needs a `match` decision, a confidence of at least **0.85** and a candidate id that
was actually offered.

**Applied to the LLM confidence, not to the search score.** The BM25 score is not
normalized across queries: in the first run the top candidate scored between 4.2 and 40.2
when the decision was a match, and between 2.7 and 29.1 when it was ambiguous. No cut on
it separates the two.

**Why 0.85.** The LLM confidence is not continuous; the model answered in a few round
values:

| confidence | matches |
| --- | --- |
| 0.95 | 31 |
| 0.90 | 42 |
| 0.85 | 3 |
| 0.80 | 4 |
| 0.70 to 0.75 | 3 |

0.85 cuts between the "near certain" and "probably" groups. The three matches accepted
exactly at 0.85 were correct. Most of the seven rejected below it look right on inspection,
but that is a handful of unlabeled cases, and one wrong merge of two people costs more than
an extra review item. How to recalibrate on labeled cases is in the
[backlog](backlog.md#threshold-calibration-on-real-boundary-cases).

## LLM usage

### One extraction call per signal

A meeting is extracted in one call with its whole transcript, which also helps
disambiguation ("bom dia carlos" in a meeting with Expresso Norte). Speakers come from the
structured field, not from the LLM.

### Decision and description in the same call

The decision call also rewrites the description, so an update costs one call, not two.

### Separate models, low reasoning effort

`EXTRACTION_MODEL` and `DECISION_MODEL` are configured separately (default `gpt-5-mini`),
so the decision model can be upgraded alone if quality requires it.

### Determinism through the cache

The GPT-5 family does not take `temperature`. Responses are cached on disk, keyed by model,
reasoning effort, prompts and response schema, so a rerun is identical, fast and free, and
a threshold can be changed without paying again.

## Storage

### Elasticsearch is the source of truth, recreated on every run

The whole run is deterministic from the first signal, so the indices are rebuilt and the
tenant is seeded before the first signal.

### Writes force a refresh

A document saved earlier in a signal must be visible to the next search of the same signal
(the organization created before its people). `refresh=true` forces it immediately;
`wait_for` gives the same guarantee but blocks each write until the next scheduled refresh,
1 s by default. At this volume forcing costs nothing. In production, with many writes,
refresh once per batch, or keep an in-memory cache of the entities touched in the current
signal and search it alongside the index.

### Review items live in memory

Nothing reads them during processing, so they are exported at the end instead of indexed.

## Interface

### Read-only

The API serves the last run from files, so it works without Elasticsearch. The UI replays a
recorded run instead of running the pipeline live: instant, deterministic, and independent
of the network or the LLM during a demo. Manual review and live streaming are in the
[backlog](backlog.md).

### The decision trace is the UI's data source

Every resolved observation emits one event with its candidates, guards, decision, outcome
and the entity before and after. The UI rebuilds the repository at any signal from it. The
trace does not change any prompt, so it never invalidates the cache.
