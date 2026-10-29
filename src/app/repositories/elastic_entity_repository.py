from collections.abc import Mapping

from elasticsearch import Elasticsearch

from app.repositories.index_mappings import INDEX_MAPPINGS, INDEX_SETTINGS
from app.services.normalization import normalize
from app.types.entity import Entity, EntityKind, SearchHit

KIND_SUFFIXES: dict[EntityKind, str] = {"PERSON": "person", "ORGANIZATION": "organization"}
ALL_SIZE = 1000


class ElasticEntityRepository:
    def __init__(self, *, client: Elasticsearch, index_prefix: str) -> None:
        self.client = client
        self.index_prefix = index_prefix
        self.counter = 0

    def index_for(self, kind: EntityKind) -> str:
        return f"{self.index_prefix}{KIND_SUFFIXES[kind]}"

    def all_indices(self) -> list[str]:
        return [self.index_for("PERSON"), self.index_for("ORGANIZATION")]

    def reset(self) -> None:
        for index in self.all_indices():
            if self.client.indices.exists(index=index):
                self.client.indices.delete(index=index)
            self.client.indices.create(
                index=index, settings=INDEX_SETTINGS, mappings=INDEX_MAPPINGS
            )
        self.counter = 0

    def next_id(self) -> str:
        self.counter += 1
        return f"e_{self.counter:03d}"

    def get(self, *, entity_id: str) -> Entity | None:
        found = self.query(
            indices=self.all_indices(), query={"ids": {"values": [entity_id]}}, size=1
        )
        return found[0] if found else None

    def save(self, *, entity: Entity) -> None:
        document = entity.model_dump()
        document["name_keys"] = sorted(
            {normalize(entity.name), *(normalize(alias) for alias in entity.aliases)}
        )
        document["emails"] = [normalize(email) for email in entity.emails]
        document["domains"] = [normalize(domain) for domain in entity.domains]
        self.client.index(
            index=self.index_for(entity.kind),
            id=entity.id,
            document=document,
            refresh="wait_for",
        )

    def find_by_email(self, *, email: str) -> Entity | None:
        found = self.query(
            indices=[self.index_for("PERSON")],
            query={"term": {"emails": normalize(email)}},
            size=1,
        )
        return found[0] if found else None

    def find_by_domain(self, *, domain: str) -> Entity | None:
        found = self.query(
            indices=[self.index_for("ORGANIZATION")],
            query={"term": {"domains": normalize(domain)}},
            size=1,
        )
        return found[0] if found else None

    def find_by_name(self, *, kind: EntityKind, name: str) -> list[Entity]:
        return self.query(
            indices=[self.index_for(kind)],
            query={"term": {"name_keys": normalize(name)}},
            size=ALL_SIZE,
        )

    def search(self, *, kind: EntityKind, name: str, size: int) -> list[SearchHit]:
        query: dict[str, object] = {
            "bool": {
                "should": [
                    {
                        "multi_match": {
                            "query": name,
                            "fields": ["name^3", "aliases^2"],
                            "fuzziness": "AUTO",
                        }
                    },
                    {
                        "multi_match": {
                            "query": name,
                            "fields": ["name.prefix^2", "aliases.prefix"],
                        }
                    },
                ],
                "minimum_should_match": 1,
            }
        }
        response = self.client.search(index=[self.index_for(kind)], query=query, size=size)
        return [
            SearchHit(entity=self.to_entity(hit["_source"]), score=float(hit["_score"] or 0.0))
            for hit in response["hits"]["hits"]
        ]

    def all(self) -> list[Entity]:
        return self.query(
            indices=self.all_indices(),
            query={"match_all": {}},
            size=ALL_SIZE,
            sort=[{"id": "asc"}],
        )

    def query(
        self,
        *,
        indices: list[str],
        query: Mapping[str, object],
        size: int,
        sort: list[Mapping[str, str]] | None = None,
    ) -> list[Entity]:
        response = self.client.search(index=indices, query=query, size=size, sort=sort)
        return [self.to_entity(hit["_source"]) for hit in response["hits"]["hits"]]

    def to_entity(self, source: Mapping[str, object]) -> Entity:
        fields = {key: value for key, value in source.items() if key != "name_keys"}
        return Entity.model_validate(fields)
