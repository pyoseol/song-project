import os
from dataclasses import dataclass


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    output_dir: str = os.environ.get("OUTPUT_DIR", "/app/outputs")
    model_cache_dir: str = os.environ.get("MODEL_CACHE_DIR", "/models")
    music_provider: str = os.environ.get("MUSIC_PROVIDER", "procedural").lower()
    image_provider: str = os.environ.get("IMAGE_PROVIDER", "procedural").lower()
    musicgen_model_id: str = os.environ.get("MUSICGEN_MODEL_ID", "facebook/musicgen-small")
    diffusion_model_id: str = os.environ.get("DIFFUSION_MODEL_ID", "runwayml/stable-diffusion-v1-5")
    hf_token: str | None = os.environ.get("HF_TOKEN")
    cors_allow_origins: str = os.environ.get("CORS_ALLOW_ORIGINS", "*")
    image_negative_prompt: str = os.environ.get(
        "IMAGE_NEGATIVE_PROMPT",
        "low quality, blurry, deformed, duplicate, watermark, text",
    )
    allow_provider_fallback: bool = _to_bool(os.environ.get("ALLOW_PROVIDER_FALLBACK"), default=True)


settings = Settings()
