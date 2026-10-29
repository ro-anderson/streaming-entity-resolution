from pathlib import Path
from typing import cast

import openai
import pytest
from pydantic import BaseModel

from app.clients.disk_cache import DiskCache
from app.clients.openai_client import LLMRefusalError, OpenAIClient


class Answer(BaseModel):
    value: str


class FakeMessage:
    def __init__(self, *, parsed: BaseModel | None, refusal: str | None) -> None:
        self.parsed = parsed
        self.refusal = refusal


class FakeChoice:
    def __init__(self, *, message: FakeMessage) -> None:
        self.message = message


class FakeCompletion:
    def __init__(self, *, message: FakeMessage) -> None:
        self.choices = [FakeChoice(message=message)]


class FakeCompletions:
    def __init__(self, *, parsed: BaseModel | None, refusal: str | None) -> None:
        self.parsed = parsed
        self.refusal = refusal
        self.calls: list[dict[str, object]] = []

    def parse(self, **kwargs: object) -> FakeCompletion:
        self.calls.append(kwargs)
        return FakeCompletion(message=FakeMessage(parsed=self.parsed, refusal=self.refusal))


class FakeChat:
    def __init__(self, *, completions: FakeCompletions) -> None:
        self.completions = completions


class FakeEmbedding:
    def __init__(self, *, embedding: list[float]) -> None:
        self.embedding = embedding


class FakeEmbeddingResponse:
    def __init__(self, *, embedding: list[float]) -> None:
        self.data = [FakeEmbedding(embedding=embedding)]


class FakeEmbeddings:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def create(self, **kwargs: object) -> FakeEmbeddingResponse:
        self.calls.append(kwargs)
        return FakeEmbeddingResponse(embedding=[0.1, 0.2, 0.3])


class FakeSDK:
    def __init__(self, *, parsed: BaseModel | None = None, refusal: str | None = None) -> None:
        self.completions = FakeCompletions(parsed=parsed, refusal=refusal)
        self.chat = FakeChat(completions=self.completions)
        self.embeddings = FakeEmbeddings()


def build_client(*, sdk: FakeSDK, directory: Path, reasoning_effort: str = "low") -> OpenAIClient:
    return OpenAIClient(
        sdk=cast(openai.OpenAI, sdk),
        cache=DiskCache(directory=directory, enabled=True),
        reasoning_effort=reasoning_effort,
        embedding_model="text-embedding-3-small",
    )


def test_parse_calls_sdk_once_for_identical_requests(tmp_path: Path) -> None:
    sdk = FakeSDK(parsed=Answer(value="yes"))
    client = build_client(sdk=sdk, directory=tmp_path)
    first = client.parse(model="gpt-5-mini", system="s", user="u", schema=Answer)
    second = client.parse(model="gpt-5-mini", system="s", user="u", schema=Answer)
    assert first == second == Answer(value="yes")
    assert len(sdk.completions.calls) == 1
    call = sdk.completions.calls[0]
    assert call["reasoning_effort"] == "low"
    assert call["response_format"] is Answer
    assert "temperature" not in call


def test_parse_cache_key_includes_reasoning_effort(tmp_path: Path) -> None:
    sdk = FakeSDK(parsed=Answer(value="yes"))
    build_client(sdk=sdk, directory=tmp_path, reasoning_effort="low").parse(
        model="gpt-5-mini", system="s", user="u", schema=Answer
    )
    build_client(sdk=sdk, directory=tmp_path, reasoning_effort="high").parse(
        model="gpt-5-mini", system="s", user="u", schema=Answer
    )
    assert len(sdk.completions.calls) == 2


def test_parse_raises_on_refusal(tmp_path: Path) -> None:
    sdk = FakeSDK(parsed=None, refusal="no can do")
    client = build_client(sdk=sdk, directory=tmp_path)
    with pytest.raises(LLMRefusalError, match="no can do"):
        client.parse(model="gpt-5-mini", system="s", user="u", schema=Answer)
    assert list(tmp_path.iterdir()) == []


def test_embed_uses_cache(tmp_path: Path) -> None:
    sdk = FakeSDK()
    client = build_client(sdk=sdk, directory=tmp_path)
    first = client.embed(text="hello")
    second = client.embed(text="hello")
    assert first == second == [0.1, 0.2, 0.3]
    assert len(sdk.embeddings.calls) == 1
