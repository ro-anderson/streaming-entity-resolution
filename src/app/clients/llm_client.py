from typing import Protocol, TypeVar

from pydantic import BaseModel

ModelT = TypeVar("ModelT", bound=BaseModel)


class LLMClient(Protocol):
    def parse(self, *, model: str, system: str, user: str, schema: type[ModelT]) -> ModelT: ...

    def embed(self, *, text: str) -> list[float]: ...
