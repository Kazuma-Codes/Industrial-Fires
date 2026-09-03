from typing import List, Tuple
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/thermal_db"
    FIRMS_MAP_KEY: str = ""
    ADMIN_API_TOKEN: str = "sih_ntro_thermal_secret_2026"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,https://thermal-intelligence.vercel.app"
    DEMO_BBOX: str = "68.0,6.5,97.5,37.5" # All-India bounding box
 
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def demo_bbox_tuple(self) -> Tuple[float, float, float, float]:
        parts = [float(p.strip()) for p in self.DEMO_BBOX.split(",")]
        if len(parts) != 4:
            return (68.0, 6.5, 97.5, 37.5)
        return (parts[0], parts[1], parts[2], parts[3])


settings = Settings()
