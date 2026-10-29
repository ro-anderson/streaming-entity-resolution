from app.clients.llm_client import LLMClient
from app.services.normalization import domain_of, find_original_span, is_personal_domain, normalize
from app.services.observation_builder import contacts_of, render_signal
from app.services.prompts import EXTRACTION_SYSTEM_PROMPT
from app.types.observation import ExtractionResult, Observation, ParticipantNote
from app.types.signal import Signal, Tenant


def signal_texts(*, signal: Signal) -> list[str]:
    texts = [signal.text or "", signal.title or ""]
    return [text for text in [*texts, *(u.text for u in signal.utterances)] if text]


def locate_surface(*, signal: Signal, surface: str) -> str | None:
    for text in signal_texts(signal=signal):
        span = find_original_span(haystack=text, needle=surface)
        if span is not None:
            return span
    return None


def signal_domains(*, signal: Signal) -> set[str]:
    return {
        domain_of(contact.email)
        for contact in contacts_of(signal=signal)
        if contact.email and not is_personal_domain(domain_of(contact.email))
    }


class ExtractionService:
    def __init__(self, *, llm: LLMClient, model: str, tenant: Tenant) -> None:
        self.llm = llm
        self.model = model
        self.system = EXTRACTION_SYSTEM_PROMPT.format(
            tenant_name=tenant.name, tenant_description=tenant.description
        )

    def extract(self, *, signal: Signal) -> tuple[list[Observation], list[ParticipantNote]]:
        result = self.llm.parse(
            model=self.model,
            system=self.system,
            user=render_signal(signal=signal),
            schema=ExtractionResult,
        )
        domains = signal_domains(signal=signal)
        observations: list[Observation] = []
        for entity in result.entities:
            located = [
                locate_surface(signal=signal, surface=s) for s in [*entity.surfaces, entity.name]
            ]
            surfaces = list(dict.fromkeys(span for span in located if span is not None))
            if not surfaces:
                continue
            domain = normalize(entity.domain) if entity.domain else None
            observations.append(
                Observation(
                    kind=entity.kind,
                    name=entity.name,
                    surfaces=surfaces,
                    domain=domain if domain in domains else None,
                    org_name=entity.org_name,
                    role=entity.role,
                    description=entity.description,
                    changed=entity.changed,
                    evidence=entity.evidence,
                )
            )
        return observations, result.participants
