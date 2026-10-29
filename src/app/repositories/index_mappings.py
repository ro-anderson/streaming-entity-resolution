INDEX_SETTINGS: dict[str, object] = {
    "analysis": {
        "filter": {
            "prefix_edge_ngram": {
                "type": "edge_ngram",
                "min_gram": 2,
                "max_gram": 15,
            }
        },
        "analyzer": {
            "folded": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding"],
            },
            "prefix": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding", "prefix_edge_ngram"],
            },
        },
    }
}

NAME_FIELD: dict[str, object] = {
    "type": "text",
    "analyzer": "folded",
    "fields": {
        "prefix": {
            "type": "text",
            "analyzer": "prefix",
            "search_analyzer": "folded",
        }
    },
}

INDEX_MAPPINGS: dict[str, object] = {
    "properties": {
        "id": {"type": "keyword"},
        "kind": {"type": "keyword"},
        "org_id": {"type": "keyword"},
        "name": NAME_FIELD,
        "aliases": NAME_FIELD,
        "name_keys": {"type": "keyword"},
        "emails": {"type": "keyword"},
        "domains": {"type": "keyword"},
        "description": {"type": "text"},
        "mentions": {"type": "object", "enabled": False},
        "revisions": {"type": "object", "enabled": False},
    }
}
