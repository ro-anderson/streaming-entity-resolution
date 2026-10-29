import json
from typing import Literal

from app.clients.llm_client import LLMClient
from app.repositories.entity_repository import EntityRepository
from app.repositories.review_repository import ReviewRepository
from app.repositories.trace_recorder import TraceRecorder
from app.services.decision_rules import accepts_match, guard_violation, has_anchor
from app.services.entity_service import EntityService
from app.services.normalization import domain_of, is_personal_domain
from app.services.observation_builder import render_signal
from app.services.prompts import DECISION_SYSTEM_PROMPT
from app.types.decision import CandidateDecision, ReviewItem
from app.types.entity import Entity
from app.types.observation import Observation
from app.types.signal import Signal, Tenant
from app.types.trace import TraceCandidate, TraceEvent, TraceSurface

NO_ANCHOR_REASON = "primeiro nome sem ancora"
MAX_SIGNAL_CHARS = 6000
ExactKey = Literal["email", "domain"]


class ResolutionService:
    def __init__(
        self,
        *,
        repository: EntityRepository,
        entities: EntityService,
        reviews: ReviewRepository,
        trace: TraceRecorder,
        llm: LLMClient,
        model: str,
        threshold: float,
        search_size: int,
        tenant: Tenant,
    ) -> None:
        self.repository = repository
        self.entities = entities
        self.reviews = reviews
        self.trace = trace
        self.llm = llm
        self.model = model
        self.threshold = threshold
        self.search_size = search_size
        self.system = DECISION_SYSTEM_PROMPT.format(tenant_name=tenant.name)

    def resolve(
        self, *, signal: Signal, observation: Observation, org_id: str | None
    ) -> Entity | None:
        exact_key = self.exact_key(observation=observation)
        exact = self.exact_match(observation=observation, exact_key=exact_key)
        if exact is not None:
            updated = self.entities.update(
                entity=exact,
                signal_id=signal.id,
                observation=observation,
                org_id=org_id,
                description=observation.description if observation.changed else "",
                replace_org=True,
            )
            self.record(
                signal=signal,
                observation=observation,
                org_id=org_id,
                exact_match=exact_key,
                outcome="updated",
                before=exact,
                after=updated,
            )
            return updated
        hits = self.repository.search(
            kind=observation.kind, name=observation.name, size=self.search_size
        )
        traced = [
            TraceCandidate(
                id=hit.entity.id,
                name=hit.entity.name,
                score=hit.score,
                removed_by=guard_violation(
                    observation=observation, org_id=org_id, candidate=hit.entity
                ),
            )
            for hit in hits
        ]
        removed = {candidate.id for candidate in traced if candidate.removed_by is not None}
        candidates = [hit.entity for hit in hits if hit.entity.id not in removed]
        if not candidates:
            return self.create_or_review(
                signal=signal,
                observation=observation,
                org_id=org_id,
                description=observation.description,
                candidates=traced,
                decision=None,
            )
        decision = self.decide(signal=signal, observation=observation, candidates=candidates)
        candidate_ids = {candidate.id for candidate in candidates}
        if accepts_match(decision=decision, candidate_ids=candidate_ids, threshold=self.threshold):
            target = next(c for c in candidates if c.id == decision.candidate_id)
            updated = self.entities.update(
                entity=target,
                signal_id=signal.id,
                observation=observation,
                org_id=org_id,
                description=decision.description,
            )
            self.record(
                signal=signal,
                observation=observation,
                org_id=org_id,
                candidates=traced,
                decision=decision,
                outcome="updated",
                before=target,
                after=updated,
            )
            return updated
        if decision.decision == "new":
            return self.create_or_review(
                signal=signal,
                observation=observation,
                org_id=org_id,
                description=decision.description or observation.description,
                candidates=traced,
                decision=decision,
            )
        reason = f"{decision.decision} ({decision.confidence:.2f}): {decision.reason}"
        self.review(
            signal=signal,
            observation=observation,
            org_id=org_id,
            reason=reason,
            candidates=traced,
            decision=decision,
        )
        return None

    def exact_key(self, *, observation: Observation) -> ExactKey | None:
        if observation.kind == "PERSON" and observation.email:
            return "email"
        has_domain = observation.domain and not is_personal_domain(observation.domain)
        if observation.kind == "ORGANIZATION" and has_domain:
            return "domain"
        return None

    def exact_match(self, *, observation: Observation, exact_key: ExactKey | None) -> Entity | None:
        if exact_key == "email" and observation.email:
            return self.repository.find_by_email(email=observation.email)
        if exact_key == "domain" and observation.domain:
            return self.repository.find_by_domain(domain=observation.domain)
        return None

    def create_or_review(
        self,
        *,
        signal: Signal,
        observation: Observation,
        org_id: str | None,
        description: str,
        candidates: list[TraceCandidate],
        decision: CandidateDecision | None,
    ) -> Entity | None:
        if has_anchor(observation=observation, org_id=org_id):
            created = self.entities.create(
                signal_id=signal.id, observation=observation, org_id=org_id, description=description
            )
            self.record(
                signal=signal,
                observation=observation,
                org_id=org_id,
                candidates=candidates,
                decision=decision,
                outcome="created",
                after=created,
            )
            return created
        self.review(
            signal=signal,
            observation=observation,
            org_id=org_id,
            reason=NO_ANCHOR_REASON,
            candidates=candidates,
            decision=decision,
        )
        return None

    def review(
        self,
        *,
        signal: Signal,
        observation: Observation,
        org_id: str | None,
        reason: str,
        candidates: list[TraceCandidate] | None = None,
        decision: CandidateDecision | None = None,
    ) -> None:
        for surface in observation.surfaces:
            self.reviews.add(item=ReviewItem(signal_id=signal.id, surface=surface, reason=reason))
        self.record(
            signal=signal,
            observation=observation,
            org_id=org_id,
            candidates=candidates or [],
            decision=decision,
            outcome="review",
            reason=reason,
        )

    def record(
        self,
        *,
        signal: Signal,
        observation: Observation,
        org_id: str | None,
        outcome: Literal["created", "updated", "review"],
        exact_match: ExactKey | None = None,
        candidates: list[TraceCandidate] | None = None,
        decision: CandidateDecision | None = None,
        reason: str | None = None,
        before: Entity | None = None,
        after: Entity | None = None,
    ) -> None:
        surfaces = [
            TraceSurface(surface=surface, source=observation.sources.get(surface, "text"))
            for surface in observation.surfaces
        ]
        self.trace.record(
            event=TraceEvent(
                signal_id=signal.id,
                kind=observation.kind,
                name=observation.name,
                surfaces=surfaces,
                email=observation.email,
                org_id=org_id,
                exact_match=exact_match,
                candidates=candidates or [],
                decision=decision,
                outcome=outcome,
                reason=reason,
                entity_id=after.id if after else None,
                before=before,
                after=after,
            )
        )

    def decide(
        self, *, signal: Signal, observation: Observation, candidates: list[Entity]
    ) -> CandidateDecision:
        described = [
            {
                "id": candidate.id,
                "name": candidate.name,
                "aliases": candidate.aliases,
                "emails": candidate.emails,
                "description": candidate.description,
                "organization": self.org_name(org_id=candidate.org_id),
            }
            for candidate in candidates
        ]
        mention = observation.model_dump(exclude={"changed", "sources"})
        if observation.email:
            mention["email_domain"] = domain_of(observation.email)
        user = "\n\n".join(
            [
                "MENCAO:\n" + json.dumps(mention, ensure_ascii=False),
                "CANDIDATOS:\n" + json.dumps(described, ensure_ascii=False),
                "SINAL:\n" + render_signal(signal=signal)[:MAX_SIGNAL_CHARS],
            ]
        )
        return self.llm.parse(
            model=self.model, system=self.system, user=user, schema=CandidateDecision
        )

    def org_name(self, *, org_id: str | None) -> str | None:
        if org_id is None:
            return None
        organization = self.repository.get(entity_id=org_id)
        return organization.name if organization else None
