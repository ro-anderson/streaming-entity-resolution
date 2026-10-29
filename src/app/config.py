from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_DIR / ".env", extra="ignore")

    openai_api_key: str = ""
    extraction_model: str = "gpt-5-mini"
    decision_model: str = "gpt-5-mini"
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = "low"
    elasticsearch_url: str = "http://localhost:9200"
    index_prefix: str = ""
    llm_cache_enabled: bool = True
    llm_cache_dir: Path = PROJECT_DIR / ".cache" / "llm"
    match_threshold: float = 0.85
    search_size: int = 5
    signals_path: Path = PROJECT_DIR / "data" / "signals.jsonl"
    tenant_path: Path = PROJECT_DIR / "data" / "tenant.json"
    out_dir: Path = PROJECT_DIR / "out"


@lru_cache
def get_settings() -> Settings:
    return Settings()
