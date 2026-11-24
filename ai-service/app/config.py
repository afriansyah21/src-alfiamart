"""Pengaturan layanan AI, dibaca dari environment variable (file .env saat pengembangan)."""
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes")


@dataclass(frozen=True)
class Settings:
    internal_api_key: str
    stub_scenarios: bool


def load_settings() -> Settings:
    key = os.getenv("INTERNAL_API_KEY", "").strip()
    if not key:
        # Sengaja gagal saat start, seperti config.js di Express: lebih baik ketahuan sekarang
        # daripada layanan jalan tanpa kunci.
        raise RuntimeError('Variabel lingkungan "INTERNAL_API_KEY" belum diisi (lihat .env.example)')
    return Settings(internal_api_key=key, stub_scenarios=_flag("STUB_SCENARIOS", "true"))


settings = load_settings()
