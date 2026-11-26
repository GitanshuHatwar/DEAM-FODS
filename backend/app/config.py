from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_key: str = Field(
        validation_alias=AliasChoices("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY")
    )
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"
    cors_origin: str = "http://localhost:5173"
    max_image_bytes: int = 1048576  # 1 MB


settings = Settings()
