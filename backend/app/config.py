from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "music_hub"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origin: str = "http://localhost:5173"
    uploads_dir: str = "uploads"
    stems_dir: str = "stems"
    database_url: str | None = None
    log_level: str = "INFO"
    max_upload_size: int = 50 * 1024 * 1024

    @property
    def db_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def sync_db_url(self) -> str:
        if self.database_url:
            return self.database_url.replace("+asyncpg", "")
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
