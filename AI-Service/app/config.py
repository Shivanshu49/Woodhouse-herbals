from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = 8001
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    allowed_origins: str = "http://localhost:3000,http://localhost:4000"
    log_level: str = "info"

    @property
    def origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
