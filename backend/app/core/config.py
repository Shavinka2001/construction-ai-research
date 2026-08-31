import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, List, Union

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


def parse_cors_origins(value: Union[str, List[str], None]) -> List[str]:
    """
    Parse CORS origins from either:
    - JSON array string: '["http://localhost:3000"]'
    - Comma-separated string: 'http://localhost:3000,http://127.0.0.1:3000'
    - Python list (defaults / programmatic use)
    """
    if value is None:
        return []

    if isinstance(value, list):
        return [str(origin).strip() for origin in value if str(origin).strip()]

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []

        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    return [
                        str(origin).strip()
                        for origin in parsed
                        if str(origin).strip()
                    ]
            except json.JSONDecodeError:
                pass

        return [
            origin.strip()
            for origin in stripped.split(",")
            if origin.strip()
        ]

    return []


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Structura.ai API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS — JSON array or comma-separated string in .env
    CORS_ORIGINS: Annotated[
        List[str],
        NoDecode,
        BeforeValidator(parse_cors_origins),
    ] = ["http://localhost:3000"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # Database — Neon PostgreSQL connection string (required)
    DATABASE_URL: str

    # Security / JWT
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- Pre-Construction Feasibility Analyzer (R26_IT_154) -------------------
    # Google Earth Engine — service-account key path (relative to backend/).
    # When the key is absent the land analyzer falls back to deterministic
    # synthetic terrain, so the API still boots and every endpoint responds.
    GEE_KEY_PATH: str = "gee-key.json"
    GEE_PROJECT: str = "landanalyzeraiproject"

    # YOLOv8 land-boundary segmentation weights (relative to backend/).
    # Fallback chain: fine-tuned .pt → yolov8n-seg.pt (auto-download) → OpenCV.
    YOLO_SEG_WEIGHTS_PATH: str = "weights/land_segmentation.pt"
    YOLO_SEG_FALLBACK: str = "yolov8n-seg.pt"

    # OCR — optional explicit path to the Tesseract binary (Windows installs
    # rarely add it to PATH). When unresolved, Module 2 returns UNVERIFIED.
    TESSERACT_CMD: str | None = None

    # External geospatial / weather services
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_USER_AGENT: str = (
        "R26-IT-154-feasibility-analyzer/1.0 (undergraduate research project)"
    )
    OPEN_METEO_URL: str = "https://api.open-meteo.com/v1/forecast"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
