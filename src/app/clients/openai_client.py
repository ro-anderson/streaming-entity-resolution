import json
from typing import TypeVar

import openai
from openai.types.shared import ReasoningEffort
from pydantic import BaseModel, TypeAdapter

from app.clients.disk_cache import DiskCache
from app.config import Settings

ModelT = TypeVar("ModelT", bound=BaseModel)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_ADAPTER = TypeAdapter(list[float])


class LLMRefusalError(Exception):
    pass


class OpenAIClient:
    def __init__(
        self,
        *,
        sdk: openai.OpenAI,
        cache: DiskCache,
        reasoning_effort: ReasoningEffort,
        embedding_model: str,
    ) -> None:
        self.sdk = sdk
        self.cache = cache
        self.reasoning_effort = reasoning_effort
        self.embedding_model = embedding_model

    def parse(self, *, model: str, system: str, user: str, schema: type[ModelT]) -> ModelT:
        key = self.cache.key(
            parts=[
                model,
                str(self.reasoning_effort),
                system,
                user,
                schema.__name__,
                json.dumps(schema.model_json_schema(), sort_keys=True),
            ]
        )
        cached = self.cache.get(key=key)
        if cached is not None:
            return schema.model_validate_json(cached)
        completion = self.sdk.chat.completions.parse(
            model=model,
            reasoning_effort=self.reasoning_effort,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format=schema,
        )
        message = completion.choices[0].message
        parsed = message.parsed
        if parsed is None:
            raise LLMRefusalError(message.refusal or "empty response")
        self.cache.put(key=key, value=parsed.model_dump_json())
        return parsed

    def embed(self, *, text: str) -> list[float]:
        key = self.cache.key(parts=["embedding", self.embedding_model, text])
        cached = self.cache.get(key=key)
        if cached is not None:
            return EMBEDDING_ADAPTER.validate_json(cached)
        response = self.sdk.embeddings.create(model=self.embedding_model, input=text)
        embedding = list(response.data[0].embedding)
        self.cache.put(key=key, value=json.dumps(embedding))
        return embedding


def build_openai_client(*, settings: Settings) -> OpenAIClient:
    return OpenAIClient(
        sdk=openai.OpenAI(api_key=settings.openai_api_key),
        cache=DiskCache(directory=settings.llm_cache_dir, enabled=settings.llm_cache_enabled),
        reasoning_effort=settings.reasoning_effort,
        embedding_model=EMBEDDING_MODEL,
    )
