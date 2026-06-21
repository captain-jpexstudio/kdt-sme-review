from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # DB
    DATABASE_URL: str = "postgresql+asyncpg://survey:pass@db:5432/surveydb"

    # Auth
    JWT_SECRET: str = "change-me"
    JWT_ACCESS_TTL_MIN: int = 120
    JWT_REFRESH_TTL_DAYS: int = 7

    # PII / 서명
    PII_FERNET_KEY: str = ""
    SIGNATURE_STORAGE: str = "/data/signatures"
    AGREEMENT_VERSION: str = "2026-06-19.v1"

    # Active Edit 임계 (spec §4.4 / §7.4)
    MIN_WORD_CHANGES: int = 1
    MIN_CHANGE_RATIO: float = 0.0
    SUSPICIOUS_RATIO: float = 0.05
    GOOD_RATIO: float = 0.30
    SIGN_MIN_INK_RATIO: float = 0.002


settings = Settings()
