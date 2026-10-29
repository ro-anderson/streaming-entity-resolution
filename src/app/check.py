import json
import sys

from app.config import get_settings
from app.services.normalization import normalize, tokens
from app.types.entity import EntityExport

HOMONYMS = [
    (
        ("Pedro Nogueira", "pedro.nogueira@caravela.io"),
        ("Pedro Almeida", "pedro.almeida@caravela.com.br"),
    ),
    (
        ("Carlos Menezes", "carlos.menezes@translog.com.br"),
        ("Carlos Souza", "carlos.souza@expressonorte.com.br"),
    ),
    (
        ("Fernanda Lima", "fernanda@rodobras.com.br"),
        ("Fernanda Okada", "fernanda.okada@bancoaurora.com.br"),
    ),
]


def names_of(*, entity: EntityExport) -> set[str]:
    return {normalize(name) for name in [entity.name, *entity.aliases]}


def is_person(*, entity: EntityExport, full_name: str, email: str) -> bool:
    return email in entity.emails or normalize(full_name) in names_of(entity=entity)


def mentions_org(*, entity: EntityExport, word: str) -> bool:
    return any(word in tokens(name) for name in names_of(entity=entity))


def find_failures(*, entities: list[EntityExport]) -> list[str]:
    failures: list[str] = []
    for (first_name, first_email), (second_name, second_email) in HOMONYMS:
        for entity in entities:
            both = is_person(entity=entity, full_name=first_name, email=first_email) and is_person(
                entity=entity, full_name=second_name, email=second_email
            )
            if both:
                failures.append(f"{entity.id} merges {first_name} and {second_name}")
    organizations = [entity for entity in entities if entity.kind == "ORGANIZATION"]
    norte = [entity.id for entity in organizations if mentions_org(entity=entity, word="norte")]
    nordeste = [
        entity.id for entity in organizations if mentions_org(entity=entity, word="nordeste")
    ]
    if not norte or not nordeste:
        failures.append(f"missing Expresso Norte {norte} or Expresso Nordeste {nordeste}")
    for entity_id in set(norte) & set(nordeste):
        failures.append(f"{entity_id} merges Expresso Norte and Expresso Nordeste")
    owners: dict[str, list[str]] = {}
    for entity in entities:
        for email in entity.emails:
            owners.setdefault(email, []).append(entity.id)
    failures.extend(f"{email} appears in {ids}" for email, ids in owners.items() if len(ids) > 1)
    return failures


def main() -> None:
    path = get_settings().out_dir / "entities.json"
    entities = [EntityExport.model_validate(item) for item in json.loads(path.read_text("utf-8"))]
    failures = find_failures(entities=entities)
    for failure in failures:
        print(f"FAIL {failure}")
    if failures:
        sys.exit(1)
    print(
        f"OK {len(entities)} entities: homonyms apart, Expresso Norte/Nordeste apart, unique emails"
    )


if __name__ == "__main__":
    main()
