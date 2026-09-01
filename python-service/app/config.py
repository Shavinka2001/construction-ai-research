from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_SERVICE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_SERVICE_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    COMPLIANCE_MODEL_PATH: str = "model/compliance_model.pkl"
    PORT: int = 8002

    def resolved_model_path(self) -> Path:
        raw = Path(self.COMPLIANCE_MODEL_PATH)
        if raw.is_absolute():
            return raw
        return _SERVICE_ROOT / raw


@lru_cache
def get_settings() -> Settings:
    return Settings()
