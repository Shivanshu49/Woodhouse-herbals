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
    # Only honour the X-Forwarded-For header when the service genuinely runs
    # behind a trusted reverse proxy. Left False, the client socket address is
    # always used so a client cannot spoof XFF to evade per-IP rate limits.
    trust_proxy: bool = False

    @property
    def origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
