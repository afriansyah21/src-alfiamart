"""Kontrak API layanan AI, ditulis sebagai kode.

FastAPI memakai kelas-kelas di file ini untuk tiga hal sekaligus:
1. menolak request yang tidak sesuai kontrak (otomatis menjadi 400 VALIDATION_ERROR),
2. memastikan response yang keluar sesuai kontrak,
3. membuat dokumentasi Swagger di /docs.

Jadi mengubah kelas di sini sama dengan mengubah kontrak. Ingat aturan sesi 5:
menambah field opsional itu aman, mengganti nama atau menghapus field itu merusak.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .periods import PeriodName

# Label intent mengikuti dataset Fadhillah (data-science/intent). Harus sama persis dengan model Rafiq.
Intent = Literal[
    "tanya_produk", "ubah_harga", "cek_penjualan", "analisis_bisnis", "tanya_panduan", "di_luar_konteks"
]
Branch = Literal["alfiamart1", "alfiamart2"]


# ---------- Request /v1/chat (sesi 2a) ----------

class ChatTurn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    # str_strip_whitespace: pesan "   " dianggap kosong lalu ditolak
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "examples": [
                {
                    "message": "yang paling laris apa?",
                    "session_id": "3f6c2a10-8b1e-4c7a-9e52-0d4f1a7b9c11",
                    "channel": "web",
                    "history": [
                        {"role": "user", "content": "berapa penjualan kemarin?"},
                        {"role": "assistant", "content": "Kemarin terjual 142 item senilai Rp3.100.000."},
                    ],
                }
            ]
        },
    )

    message: str = Field(min_length=1, max_length=500, description="Pesan owner, 1-500 karakter")
    session_id: UUID = Field(description="Dibuat Express, satu per percakapan. Dipakai untuk jejak di log")
    channel: Literal["web", "telegram"] = Field(default="web", description="Asal pesan; menentukan format jawaban")
    history: list[ChatTurn] = Field(
        default_factory=list,
        max_length=6,
        description="Maksimal 6 pesan terakhir, urut terlama ke terbaru, TIDAK termasuk pesan saat ini",
    )


# ---------- Response /v1/chat (sesi 2b) ----------

class PriceProposal(BaseModel):
    """Usulan ubah harga. AI tidak pernah mengubah harga; owner menyimpannya lewat pratinjau (FS-4)."""

    type: Literal["price_proposal"] = "price_proposal"
    product_id: UUID
    sku: str
    name: str
    old_price: int = Field(ge=0, description="Harga saat usulan dibuat; pratinjau memberi peringatan bila sudah berubah")
    new_price: int = Field(ge=0)


class PriceRevert(BaseModel):
    """Usulan membatalkan perubahan harga terakhir (dataset: 'batalin perubahan harga telur')."""

    type: Literal["price_revert"] = "price_revert"
    history_id: int = Field(ge=1, description="ID riwayat harga untuk POST /api/v1/price-history/{id}/revert")
    product_id: UUID
    sku: str
    name: str
    current_price: int = Field(ge=0)
    revert_to_price: int = Field(ge=0)


class Source(BaseModel):
    """Dasar jawaban (syarat AE-4: dapat ditelusuri ke sumbernya)."""

    type: Literal["product", "guide"] = Field(description="product = data produk, guide = dokumen panduan/FAQ")
    id: str = Field(description="SKU untuk produk, atau ID dokumen panduan")
    title: str


class ChatData(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0, le=1)
    reply: str = Field(min_length=1, max_length=1000, description="Teks biasa tanpa format tebal/miring; boleh baris baru")
    action: PriceProposal | PriceRevert | None = None
    sources: list[Source] = Field(default_factory=list)
    fallback: bool = Field(default=False, description="true = jawaban dari template karena LLM atau data sedang bermasalah")


class ChatResponse(BaseModel):
    success: Literal[True] = True
    data: ChatData


# ---------- Response /v1/summaries (sesi 3) ----------

class SummaryPeriod(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: PeriodName
    from_: datetime = Field(alias="from", description="Awal periode, WIB")
    to: datetime = Field(description="Akhir periode, WIB (inklusif)")


class TopProduct(BaseModel):
    sku: str
    name: str
    qty: int = Field(ge=0)


class BranchSales(BaseModel):
    revenue: int = Field(ge=0)
    total_items: int = Field(ge=0)


class SalesFacts(BaseModel):
    transactions: int = Field(ge=0)
    total_items: int = Field(ge=0)
    revenue: int = Field(ge=0, description="Omzet dalam rupiah")
    revenue_change_pct: float | None = Field(default=None, description="Dibanding periode sebelumnya; null bila tidak bisa dihitung")
    top_products: list[TopProduct] = Field(default_factory=list)
    by_branch: dict[Branch, BranchSales] = Field(default_factory=dict)


class PriceChangeItem(BaseModel):
    sku: str
    name: str
    old_price: int | None = Field(default=None, ge=0, description="null untuk produk yang baru ditambahkan")
    new_price: int = Field(ge=0)
    changed_at: datetime


class PriceChangeFacts(BaseModel):
    changes_count: int = Field(ge=0)
    items: list[PriceChangeItem] = Field(default_factory=list)


class SummaryData(BaseModel):
    type: Literal["sales", "price_changes"]
    period: SummaryPeriod
    facts: SalesFacts | PriceChangeFacts | None = Field(description="Angka untuk program; null bila data belum bisa diambil")
    text: str = Field(min_length=1, description="Kalimat ringkasan untuk owner")
    fallback: bool = False
    generated_at: datetime = Field(description="Kapan ringkasan dibuat (ringkasan disimpan di cache)")


class SummaryResponse(BaseModel):
    success: Literal[True] = True
    data: SummaryData


# ---------- Health dan error ----------

class HealthData(BaseModel):
    status: Literal["ok"]
    model_intent: Literal["loaded", "stub"]


class HealthResponse(BaseModel):
    success: Literal[True] = True
    data: HealthData


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str = Field(description="VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | MODEL_UNAVAILABLE | INTERNAL_ERROR")
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    success: Literal[False] = False
    error: ErrorBody


ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "VALIDATION_ERROR: request tidak sesuai kontrak"},
    401: {"model": ErrorResponse, "description": "UNAUTHORIZED: X-Internal-Key tidak ada atau salah"},
    500: {"model": ErrorResponse, "description": "INTERNAL_ERROR: bug tak terduga"},
    503: {"model": ErrorResponse, "description": "MODEL_UNAVAILABLE: model intent belum siap"},
}
