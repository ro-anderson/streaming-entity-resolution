from app.repositories.entity_repository import EntityRepository
from app.repositories.review_repository import ReviewRepository
from app.services.extraction_service import ExtractionService
from app.services.normalization import domain_of, is_personal_domain, normalize
from app.services.observation_builder import build_structured_observations
from app.services.resolution_service import ResolutionService
from app.types.observation import Observation, ParticipantNote
from app.types.signal import Signal


def enrich(*, observation: Observation, notes: list[ParticipantNote]) -> Observation:
    keys = {normalize(surface) for surface in observation.surfaces}
    note = next((note for note in notes if normalize(note.name) in keys), None)
    if note is None:
        return observation
    return observation.model_copy(
        update={
            "org_name": note.org_name,
            "role": note.role,
            "description": note.description,
            "changed": note.changed,
        }
    )


class SignalConsumer:
    def __init__(
        self,
        *,
        extraction: ExtractionService,
        resolution: ResolutionService,
        repository: EntityRepository,
        reviews: ReviewRepository,
    ) -> None:
        self.extraction = extraction
        self.resolution = resolution
        self.repository = repository
        self.reviews = reviews

    def handle(self, *, signal: Signal) -> None:
        structured, unnamed = build_structured_observations(signal=signal)
        for item in unnamed:
            speaker = Observation(
                kind="PERSON",
                name=item.surface,
                surfaces=[item.surface],
                sources={item.surface: "speaker"},
            )
            self.resolution.review(
                signal=signal, observation=speaker, org_id=None, reason=item.reason
            )
        extracted, notes = self.extraction.extract(signal=signal)
        org_ids: dict[str, str] = {}
        for observation in (o for o in extracted if o.kind == "ORGANIZATION"):
            organization = self.resolution.resolve(
                signal=signal, observation=observation, org_id=None
            )
            if organization is not None:
                names = [observation.name, *observation.surfaces, organization.name]
                org_ids.update({normalize(name): organization.id for name in names})
        people = [enrich(observation=o, notes=notes) for o in structured]
        people += [o for o in extracted if o.kind == "PERSON"]
        for observation in people:
            org_id = self.org_id_for(observation=observation, org_ids=org_ids)
            self.resolution.resolve(signal=signal, observation=observation, org_id=org_id)

    def org_id_for(self, *, observation: Observation, org_ids: dict[str, str]) -> str | None:
        if observation.email and not is_personal_domain(domain_of(observation.email)):
            organization = self.repository.find_by_domain(domain=domain_of(observation.email))
            if organization is not None:
                return organization.id
        if not observation.org_name:
            return None
        known = org_ids.get(normalize(observation.org_name))
        if known is not None:
            return known
        found = self.repository.find_by_name(kind="ORGANIZATION", name=observation.org_name)
        return found[0].id if len(found) == 1 else None
