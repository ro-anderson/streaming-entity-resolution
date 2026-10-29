from app.services.normalization import is_bot, is_speaker_placeholder, normalize, tokens
from app.types.decision import ReviewItem
from app.types.observation import Observation, SurfaceSource
from app.types.signal import Contact, Signal

UNNAMED_SPEAKER_REASON = "locutor sem nome"
EVIDENCE_UTTERANCES = 5
MIN_FULL_NAME_TOKENS = 2


def render_signal(*, signal: Signal) -> str:
    lines = [f"sinal: {signal.id} ({signal.source}, {signal.occurred_at.isoformat()})"]
    if signal.channel:
        lines.append(f"canal: {signal.channel}")
    if signal.title:
        lines.append(f"titulo: {signal.title}")
    if signal.author:
        lines.append(f"autor: {signal.author.name} <{signal.author.email or 'sem email'}>")
    if signal.participants:
        rendered = ", ".join(
            f"{contact.name} <{contact.email or 'sem email'}>" for contact in signal.participants
        )
        lines.append(f"participantes: {rendered}")
    if signal.text:
        lines.append(f"texto: {signal.text}")
    if signal.utterances:
        lines.append("falas:")
        lines.extend(f"{utterance.speaker}: {utterance.text}" for utterance in signal.utterances)
    return "\n".join(lines)


def contacts_of(*, signal: Signal) -> list[Contact]:
    contacts = [signal.author] if signal.author else []
    return [*contacts, *signal.participants]


def sourced_contacts(*, signal: Signal) -> list[tuple[Contact, SurfaceSource]]:
    author: list[tuple[Contact, SurfaceSource]] = (
        [(signal.author, "author")] if signal.author else []
    )
    return [*author, *((contact, "participant") for contact in signal.participants)]


def contact_key(*, contact: Contact) -> str:
    return (
        f"email:{normalize(contact.email)}" if contact.email else f"name:{normalize(contact.name)}"
    )


def evidence_for(*, signal: Signal, surfaces: list[str]) -> str:
    if signal.text:
        return signal.text
    keys = {normalize(surface) for surface in surfaces}
    spoken = [u.text for u in signal.utterances if normalize(u.speaker) in keys]
    return "\n".join([signal.title or "", *spoken[:EVIDENCE_UTTERANCES]]).strip()


def build_structured_observations(*, signal: Signal) -> tuple[list[Observation], list[ReviewItem]]:
    surfaces_by_key: dict[str, list[str]] = {}
    names_by_key: dict[str, str] = {}
    emails_by_key: dict[str, str | None] = {}
    full_name_keys: dict[str, str] = {}
    sources_by_key: dict[str, dict[str, SurfaceSource]] = {}
    for contact, source in sourced_contacts(signal=signal):
        if is_bot(contact):
            continue
        key = contact_key(contact=contact)
        surfaces_by_key.setdefault(key, [])
        if contact.name not in surfaces_by_key[key]:
            surfaces_by_key[key].append(contact.name)
        sources_by_key.setdefault(key, {}).setdefault(contact.name, source)
        names_by_key.setdefault(key, contact.name)
        emails_by_key.setdefault(key, contact.email)
        if len(tokens(contact.name)) >= MIN_FULL_NAME_TOKENS:
            full_name_keys.setdefault(normalize(contact.name), key)
    reviews: list[ReviewItem] = []
    for speaker in dict.fromkeys(utterance.speaker for utterance in signal.utterances):
        if is_speaker_placeholder(speaker):
            reviews.append(
                ReviewItem(signal_id=signal.id, surface=speaker, reason=UNNAMED_SPEAKER_REASON)
            )
            continue
        key = full_name_keys.get(normalize(speaker), f"speaker:{normalize(speaker)}")
        surfaces_by_key.setdefault(key, [])
        if speaker not in surfaces_by_key[key]:
            surfaces_by_key[key].append(speaker)
        sources_by_key.setdefault(key, {}).setdefault(speaker, "speaker")
        names_by_key.setdefault(key, speaker)
        emails_by_key.setdefault(key, None)
    observations = [
        Observation(
            kind="PERSON",
            name=names_by_key[key],
            surfaces=surfaces,
            email=emails_by_key[key],
            evidence=evidence_for(signal=signal, surfaces=surfaces),
            sources=sources_by_key[key],
        )
        for key, surfaces in surfaces_by_key.items()
    ]
    return observations, reviews
