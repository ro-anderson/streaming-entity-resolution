from elasticsearch import Elasticsearch

from app.config import Settings


def build_elastic_client(*, settings: Settings) -> Elasticsearch:
    return Elasticsearch(settings.elasticsearch_url)
