"""Titik masuk layanan AI SRC Alfiamart.

Jalankan:  uvicorn app.main:app --reload --port 8000
Dokumentasi (Swagger): http://localhost:8000/docs
"""
import logging

from fastapi import APIRouter, Depends, FastAPI
from fastapi.openapi.utils import get_openapi

from .errors import register_error_handlers
from .routers import chat, summaries
from .schemas import HealthData, HealthResponse
from .security import require_internal_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

DESCRIPTION = """
Layanan AI untuk chatbot dan ringkasan dasbor owner. **Status: stub** (jawaban contoh sesuai kontrak).

Aturan global (sesi 5):
- Hanya dipanggil oleh back-end Express, tidak pernah langsung dari browser. Karena itu CORS sengaja tidak diaktifkan.
- Semua endpoint `/v1/*` wajib membawa header `X-Internal-Key`. `/health` terbuka dan tidak berisi rahasia.
- Respons: `{ success: true, data }` atau `{ success: false, error: { code, message, details? } }`.
- Harga dalam bilangan bulat rupiah. Waktu dalam ISO 8601; periode dihitung dalam WIB (+07:00).
- Express menunggu maksimal 15 detik. Di dalam layanan: ambil data maksimal 5 detik, LLM maksimal 8 detik.
- Masalah LLM atau data dijawab dengan `fallback: true`, bukan error. Error hanya bila layanan tidak bisa bekerja.
"""

app = FastAPI(title="SRC Alfiamart AI Service", version="0.1.0", description=DESCRIPTION)
register_error_handlers(app)


@app.get("/health", response_model=HealthResponse, tags=["sistem"], summary="Cek layanan hidup")
def health() -> HealthResponse:
    return HealthResponse(data=HealthData(status="ok", model_intent="stub"))


v1 = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])
v1.include_router(chat.router)
v1.include_router(summaries.router)
app.include_router(v1)


def _openapi_without_422():
    """FastAPI otomatis menulis status 422 di Swagger, padahal kontrak kita memakai 400. Bagian itu dihapus
    supaya dokumentasi yang dibaca Ammar sama dengan perilaku sebenarnya."""
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version=app.version, description=app.description, routes=app.routes)
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation.get("responses", {}).pop("422", None)
    app.openapi_schema = schema
    return schema


app.openapi = _openapi_without_422
