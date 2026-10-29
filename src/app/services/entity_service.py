from app.repositories.entity_repository import EntityRepository
from app.services.decision_rules import choose_name
from app.services.normalization import normalize
from app.types.entity import Entity, Mention, Revision
from app.types.observation import Observation
from app.types.signal import Tenant


def unique_by_key(*, values: list[str], excluded: set[str]) -> list[str]:
    seen = set(excluded)
    result: list[str] = []
    for value in values:
        key = normalize(value)
        if key and key not in seen:
            seen.add(key)
            result.append(value)
    return result


def merge_observation(
    *,
    entity: Entity,
    signal_id: str,
    observation: Observation,
    org_id: str | None,
    description: str,
    replace_org: bool,
) -> Entity:
    name = choose_name(current=entity.name, incoming=observation.name)
    aliases = unique_by_key(
        values=[*entity.aliases, entity.name, observation.name, *observation.surfaces],
        excluded={normalize(name)},
    )
    existing_mentions = {(mention.signal_id, mention.surface) for mention in entity.mentions}
    new_mentions = [
        Mention(signal_id=signal_id, surface=surface)
        for surface in dict.fromkeys(observation.surfaces)
        if (signal_id, surface) not in existing_mentions
    ]
    emails = [normalize(email) for email in entity.emails]
    if observation.email is not None and normalize(observation.email) not in emails:
        emails.append(normalize(observation.email))
    domains = [normalize(domain) for domain in entity.domains]
    if observation.domain is not None and normalize(observation.domain) not in domains:
        domains.append(normalize(observation.domain))
    next_org_id = org_id if (replace_org and org_id is not None) else (entity.org_id or org_id)
    return entity.model_copy(
        update={
            "name": name,
            "aliases": aliases,
            "emails": emails,
            "domains": domains,
            "org_id": next_org_id,
            "description": description.strip() or entity.description,
            "mentions": [*entity.mentions, *new_mentions],
        }
    )


def with_revision(*, before: Entity | None, after: Entity, signal_id: str) -> Entity:
    unchanged = (
        before is not None and before.name == after.name and before.description == after.description
    )
    if unchanged:
        return after
    revision = Revision(signal_id=signal_id, name=after.name, description=after.description)
    return after.model_copy(update={"revisions": [*after.revisions, revision]})


class EntityService:
    def __init__(self, *, repository: EntityRepository) -> None:
        self.repository = repository

    def create(
        self, *, signal_id: str, observation: Observation, org_id: str | None, description: str
    ) -> Entity:
        blank = Entity(id=self.repository.next_id(), kind=observation.kind, name=observation.name)
        merged = merge_observation(
            entity=blank,
            signal_id=signal_id,
            observation=observation,
            org_id=org_id,
            description=description,
            replace_org=False,
        )
        created = with_revision(before=None, after=merged, signal_id=signal_id)
        self.repository.save(entity=created)
        return created

    def update(
        self,
        *,
        entity: Entity,
        signal_id: str,
        observation: Observation,
        org_id: str | None,
        description: str,
        replace_org: bool = False,
    ) -> Entity:
        merged = merge_observation(
            entity=entity,
            signal_id=signal_id,
            observation=observation,
            org_id=org_id,
            description=description,
            replace_org=replace_org,
        )
        updated = with_revision(before=entity, after=merged, signal_id=signal_id)
        self.repository.save(entity=updated)
        return updated

    def seed_tenant(self, *, tenant: Tenant) -> Entity:
        seeded = Entity(
            id=self.repository.next_id(),
            kind="ORGANIZATION",
            name=tenant.name,
            description=tenant.description,
            domains=[normalize(domain) for domain in tenant.domains],
        )
        self.repository.save(entity=seeded)
        return seeded
