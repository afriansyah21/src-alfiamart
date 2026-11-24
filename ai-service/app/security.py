"""Pintu masuk layanan AI (sesi 5): hanya Express yang memegang X-Internal-Key."""
import secrets

from fastapi import Header

from .config import settings
from .errors import ApiError


def require_internal_key(
    x_internal_key: str | None = Header(default=None, description="Kunci rahasia antara Express dan layanan AI"),
) -> None:
    # compare_digest membandingkan kunci tanpa membocorkan petunjuk lewat lama waktu pengecekan
    if not x_internal_key or not secrets.compare_digest(
        x_internal_key.encode(), settings.internal_api_key.encode()
    ):
        raise ApiError(401, "UNAUTHORIZED", "X-Internal-Key tidak ada atau salah")
