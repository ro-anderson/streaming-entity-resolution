from collections.abc import Iterator

import pytest
from elasticsearch import Elasticsearch

from app.repositories.elastic_entity_repository import ElasticEntityRepository
from app.types.entity import Entity, EntityKind, Mention

ELASTIC_URL = "http://localhost:9200"
TEST_PREFIX = "test_"


@pytest.fixture(scope="module")
def client() -> Iterator[Elasticsearch]:
    elastic = Elasticsearch(ELASTIC_URL)
    if not elastic.ping():
        pytest.skip("Elasticsearch is not reachable")
    yield elastic
    for suffix in ("person", "organization"):
        elastic.indices.delete(index=f"{TEST_PREFIX}{suffix}", ignore_unavailable=True)


@pytest.fixture
def repository(client: Elasticsearch) -> ElasticEntityRepository:
    repo = ElasticEntityRepository(client=client, index_prefix=TEST_PREFIX)
    repo.reset()
    return repo


def make_entity(
    repository: ElasticEntityRepository,
    *,
    kind: EntityKind,
    name: str,
    aliases: list[str] | None = None,
    emails: list[str] | None = None,
    domains: list[str] | None = None,
) -> Entity:
    entity = Entity(
        id=repository.next_id(),
        kind=kind,
        name=name,
        aliases=aliases or [],
        emails=emails or [],
        domains=domains or [],
    )
    repository.save(entity=entity)
    return entity


def names(entities: list[Entity]) -> list[str]:
    return [entity.name for entity in entities]


def test_next_id_is_global_and_sequential(repository: ElasticEntityRepository) -> None:
    first = make_entity(repository, kind="PERSON", name="Ana Lima")
    second = make_entity(repository, kind="ORGANIZATION", name="Acme")
    assert (first.id, second.id, repository.next_id()) == ("e_001", "e_002", "e_003")


def test_save_then_get_roundtrip(repository: ElasticEntityRepository) -> None:
    entity = Entity(
        id=repository.next_id(),
        kind="PERSON",
        name="Ana Lima",
        aliases=["Aninha"],
        emails=["ana@acme.com"],
        description="Head of sales",
        mentions=[Mention(signal_id="s_1", surface="Ana")],
        org_id="e_999",
    )
    repository.save(entity=entity)
    assert repository.get(entity_id=entity.id) == entity
    assert repository.get(entity_id="e_404") is None


def test_saved_entity_is_searchable_immediately(repository: ElasticEntityRepository) -> None:
    make_entity(repository, kind="PERSON", name="Bruno Souza")
    assert names(repository.search(kind="PERSON", name="Bruno Souza", size=5)) == ["Bruno Souza"]


def test_find_by_email_is_case_insensitive(repository: ElasticEntityRepository) -> None:
    entity = make_entity(repository, kind="PERSON", name="Ana Lima", emails=["Ana.Lima@Acme.com"])
    found = repository.find_by_email(email="ANA.LIMA@acme.COM")
    assert found is not None
    assert found.id == entity.id
    assert repository.find_by_email(email="other@acme.com") is None


def test_find_by_domain(repository: ElasticEntityRepository) -> None:
    entity = make_entity(repository, kind="ORGANIZATION", name="Acme", domains=["Acme.com"])
    found = repository.find_by_domain(domain="acme.com")
    assert found is not None
    assert found.id == entity.id
    assert repository.find_by_domain(domain="other.com") is None


def test_find_by_name_matches_alias_without_accent(repository: ElasticEntityRepository) -> None:
    entity = make_entity(
        repository, kind="ORGANIZATION", name="Rodobras Logistica", aliases=["Rodobrás"]
    )
    found = repository.find_by_name(kind="ORGANIZATION", name="rodobras")
    assert [item.id for item in found] == [entity.id]
    assert repository.find_by_name(kind="PERSON", name="rodobras") == []


def test_search_finds_prefix_nickname(repository: ElasticEntityRepository) -> None:
    make_entity(repository, kind="PERSON", name="Joana Prates")
    make_entity(repository, kind="PERSON", name="Marcos Pereira")
    assert names(repository.search(kind="PERSON", name="Jo", size=5)) == ["Joana Prates"]


def test_search_finds_fuzzy_typo(repository: ElasticEntityRepository) -> None:
    make_entity(repository, kind="PERSON", name="Fernanda Okada")
    make_entity(repository, kind="PERSON", name="Marcos Pereira")
    found = names(repository.search(kind="PERSON", name="Fernanda Okda", size=5))
    assert found[0] == "Fernanda Okada"


def test_search_ignores_accents(repository: ElasticEntityRepository) -> None:
    make_entity(repository, kind="ORGANIZATION", name="Rodobrás")
    found = names(repository.search(kind="ORGANIZATION", name="Rodobras", size=5))
    assert found == ["Rodobrás"]


def test_search_does_not_cross_kinds(repository: ElasticEntityRepository) -> None:
    make_entity(repository, kind="ORGANIZATION", name="Joana Prates Consultoria")
    assert repository.search(kind="PERSON", name="Joana Prates", size=5) == []


def test_all_returns_both_kinds(repository: ElasticEntityRepository) -> None:
    person = make_entity(repository, kind="PERSON", name="Ana Lima")
    organization = make_entity(repository, kind="ORGANIZATION", name="Acme")
    other = make_entity(repository, kind="PERSON", name="Bruno Souza")
    assert [entity.id for entity in repository.all()] == [person.id, organization.id, other.id]
