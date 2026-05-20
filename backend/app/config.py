from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    # DATABASE_URL: str = (
    #     "postgresql://sigdp_user:sigdp_password@localhost:5432/sigdp_gabon"
    # )
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/sigdp_gabon"
    # DATABASE_URL: str = "postgresql://app_user:SigdpConnect2026!@localhost:5432/app_db"

    # JWT
    SECRET_KEY: str = "1a09c1f718fa82b7a67d1f67baca13163f4380a632418df3f9d4c791ac62a69f"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Application
    APP_NAME: str = "SIGDP-GABON API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:4200",
        "http://localhost:8000",
        "https://sigdp.org",
        "https://www.sigdp.org",
    ]

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
