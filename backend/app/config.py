"""Application settings loaded from environment variables / .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "").strip()
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

    supabase_url: str = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    # Service-role key: used server-side only, never shipped to the browser.
    supabase_key: str = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    local_db_path: Path = Path(os.getenv("LOCAL_DB_PATH", BASE_DIR / "data" / "trips.json"))
    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]

    @property
    def ai_enabled(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)


settings = Settings()
