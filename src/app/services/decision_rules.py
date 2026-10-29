from typing import Literal

from app.services.normalization import normalize, tokens
from app.types.decision import CandidateDecision
from app.types.entity import Entity
from app.types.observation import Observation

MIN_ANCHORED_NAME_TOKENS = 2
GuardName = Literal["email", "org_id"]


def guard_violation(
    *, observation: Observation, org_id: str | None, candidate: Entity
) -> GuardName | None:
    candidate_emails = {normalize(email) for email in candidate.emails}
    email_conflict = (
        observation.email is not None
        and bool(candidate_emails)
        and normalize(observation.email) not in candidate_emails
    )
    if email_conflict:
        return "email"
    if org_id is not None and candidate.org_id is not None and org_id != candidate.org_id:
        return "org_id"
    return None


def violates_guards(*, observation: Observation, org_id: str | None, candidate: Entity) -> bool:
    return guard_violation(observation=observation, org_id=org_id, candidate=candidate) is not None


def accepts_match(
    *, decision: CandidateDecision, candidate_ids: set[str], threshold: float
) -> bool:
    return (
        decision.decision == "match"
        and decision.candidate_id in candidate_ids
        and decision.confidence >= threshold
    )


def has_anchor(*, observation: Observation, org_id: str | None) -> bool:
    if observation.kind == "ORGANIZATION":
        return True
    return (
        observation.email is not None
        or len(tokens(observation.name)) >= MIN_ANCHORED_NAME_TOKENS
        or org_id is not None
        or bool(observation.role)
    )


def creates_on_ambiguity(*, observation: Observation) -> bool:
    return observation.email is not None


def is_prefix_expansion(*, current: list[str], incoming: list[str]) -> bool:
    adds_tokens = len(incoming) > len(current)
    position = 0
    for token in current:
        while position < len(incoming) and not expands_token(
            current=token, incoming=incoming[position], adds_tokens=adds_tokens
        ):
            position += 1
        if position == len(incoming):
            return False
        position += 1
    return True


def expands_token(*, current: str, incoming: str, adds_tokens: bool) -> bool:
    if current == incoming:
        return True
    is_initial = len(current) == 1
    return incoming.startswith(current) and (is_initial or adds_tokens)


def choose_name(*, current: str, incoming: str) -> str:
    expands = is_prefix_expansion(current=tokens(current), incoming=tokens(incoming))
    if expands and len(normalize(incoming)) > len(normalize(current)):
        return incoming
    return current
