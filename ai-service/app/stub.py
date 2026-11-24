"""JAWABAN CONTOH (STUB). Ini BUKAN model AI.

Gunanya: Express (Ammar) dan dasbor (Iqbal) bisa disambungkan ke layanan AI sekarang,
sebelum model intent Rafiq dan LLM siap. Bentuk jawabannya sudah sesuai kontrak; isinya contoh.

Nanti diganti satu per satu tanpa mengubah kontrak:
- stub_classify()   -> model intent + pengambil entitas (Rafiq)
- build_chat_data() -> jalur per intent + klien data + LLM (Rafiq dan kamu)
- build_summary()   -> klien data + pandas + LLM (kamu)

Produk dan angka diambil dari data contoh (seed) di repo. ID produk palsu.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID

from .errors import ApiError
from .periods import PeriodName, resolve_period
from .schemas import (
    BranchSales, ChatData, Intent, PriceChangeFacts, PriceChangeItem, PriceProposal, PriceRevert,
    SalesFacts, Source, SummaryData, SummaryPeriod, TopProduct,
)

# Header X-Stub-Scenario untuk menguji penanganan gangguan di Express (aktif bila STUB_SCENARIOS=true).
StubScenario = Literal["fallback", "no_data", "slow", "unavailable", "crash"]

GULA_ID = UUID("9b1e4c7a-2f3d-4e5a-8b6c-1d2e3f4a5b6c")
TELUR_ID = UUID("4c8d2e1f-7a6b-4c3d-9e8f-0a1b2c3d4e5f")
FALLBACK_NOTE = " (Asisten AI sedang terbatas, jawaban ini dibuat otomatis.)"
NO_DATA_REPLY = "Data belum bisa diambil saat ini. Coba lagi beberapa menit lagi."


async def apply_failure_scenario(scenario: StubScenario | None) -> None:
    """Gangguan yang membuat layanan gagal total (sesi 2c dan 5)."""
    if scenario == "slow":
        await asyncio.sleep(20)  # lebih lama dari batas tunggu Express (15 detik)
    elif scenario == "unavailable":
        raise ApiError(503, "MODEL_UNAVAILABLE", "Model intent belum siap, coba lagi sebentar")
    elif scenario == "crash":
        raise RuntimeError("Simulasi bug untuk menguji penanganan error di Express")


def stub_classify(message: str) -> Intent:
    """Aturan kata kunci SEMENTARA. Akan diganti model intent Rafiq."""
    text = f" {message.lower()} "
    if any(k in text for k in (" cara ", "gimana cara", "artinya")):
        return "tanya_panduan"
    if "harga" in text and any(k in text for k in ("batal", "kembalikan", "ubah", "ganti", "naik", "turun", " jadi ")):
        return "ubah_harga"
    if any(k in text for k in ("kenapa", "saran", "prediksi", "strategi", "penyebab")):
        return "analisis_bisnis"
    if any(k in text for k in ("omzet", "laku", "terjual", "penjualan", "transaksi")):
        return "cek_penjualan"
    if any(k in text for k in ("harga", "stok", "brp", "berapa")):
        return "tanya_produk"
    return "di_luar_konteks"


def _wants_revert(message: str) -> bool:
    text = message.lower()
    return "batal" in text or "kembalikan" in text


def build_chat_data(message: str, channel: str, scenario: StubScenario | None) -> ChatData:
    intent = stub_classify(message)
    needs_data = intent in ("tanya_produk", "ubah_harga", "cek_penjualan", "analisis_bisnis")

    if scenario == "no_data" and needs_data:
        # Data dari Express gagal diambil: tetap jawab, tanpa angka (sesi 2c)
        return ChatData(intent=intent, confidence=0.9, reply=NO_DATA_REPLY, fallback=True)

    action = None
    sources: list[Source] = []
    if intent == "tanya_produk":
        reply = "Harga Beras 5 kg saat ini Rp68.000 per karung. Stoknya: Alfiamart 1 ada 12, Alfiamart 2 ada 5."
        sources = [Source(type="product", id="BRS-5KG", title="Beras 5 kg")]
    elif intent == "ubah_harga" and _wants_revert(message):
        reply = "Saya siapkan pembatalan perubahan harga Telur ayam 1 kg: dari Rp30.000 kembali ke Rp29.000."
        action = PriceRevert(history_id=42, product_id=TELUR_ID, sku="TLR-1KG", name="Telur ayam 1 kg",
                             current_price=30000, revert_to_price=29000)
    elif intent == "ubah_harga":
        reply = "Saya siapkan perubahan harga Gula pasir 1 kg dari Rp17.500 menjadi Rp18.000."
        action = PriceProposal(product_id=GULA_ID, sku="GLA-1KG", name="Gula pasir 1 kg",
                               old_price=17500, new_price=18000)
    elif intent == "cek_penjualan":
        reply = "Kemarin terjual 142 item senilai Rp3.100.000. Alfiamart 1 Rp1.900.000, Alfiamart 2 Rp1.200.000."
    elif intent == "analisis_bisnis":
        reply = ("Omzet minggu ini turun terutama karena penjualan rokok di Alfiamart 2 lebih rendah dari minggu lalu. "
                 "Coba cek ketersediaan stok rokok di cabang tersebut.")
    elif intent == "tanya_panduan":
        reply = "Untuk impor produk, buka menu Produk, pilih Impor CSV, lalu unggah file sesuai contoh format."
        sources = [Source(type="guide", id="panduan-impor-csv", title="Cara impor produk dari CSV")]
    else:
        reply = "Maaf, saya hanya bisa membantu urusan toko: harga, stok, penjualan, dan cara memakai aplikasi."

    if action is not None:
        # Telegram tidak bisa menampilkan kartu "Buka pratinjau" (sesi 2b)
        reply += " Buka dasbor untuk memeriksa dan menyimpannya." if channel == "telegram" else " Silakan cek di pratinjau."

    fallback = scenario == "fallback"
    if fallback:
        reply += FALLBACK_NOTE
    return ChatData(intent=intent, confidence=0.9, reply=reply, action=action, sources=sources, fallback=fallback)


_PERIOD_LABEL = {
    "hari_ini": "Hari ini", "kemarin": "Kemarin", "7_hari_terakhir": "Selama 7 hari terakhir",
    "minggu_ini": "Minggu ini", "minggu_lalu": "Minggu lalu", "bulan_ini": "Bulan ini", "bulan_lalu": "Bulan lalu",
}


def build_summary(kind: str, period_name: PeriodName, now: datetime, scenario: StubScenario | None) -> SummaryData:
    start, end = resolve_period(period_name, now)
    period = SummaryPeriod(name=period_name, from_=start, to=end)
    label = _PERIOD_LABEL[period_name]

    if scenario == "no_data":
        return SummaryData(type=kind, period=period, facts=None, fallback=True, generated_at=now,
                           text="Ringkasan belum tersedia karena data belum bisa diambil. Coba lagi beberapa menit lagi.")

    if kind == "sales":
        facts = SalesFacts(
            transactions=87, total_items=142, revenue=3_100_000, revenue_change_pct=8.2,
            top_products=[TopProduct(sku="RKK-A", name="Rokok contoh A (12 batang)", qty=38)],
            by_branch={"alfiamart1": BranchSales(revenue=1_900_000, total_items=85),
                       "alfiamart2": BranchSales(revenue=1_200_000, total_items=57)},
        )
        text = (f"{label} terjual 142 item senilai Rp3.100.000, naik 8,2% dari periode sebelumnya. "
                "Alfiamart 1 Rp1.900.000 dan Alfiamart 2 Rp1.200.000. Terlaris: Rokok contoh A (38 bungkus).")
    else:
        changed_at = min(start + timedelta(hours=9, minutes=15), end)
        facts = PriceChangeFacts(changes_count=2, items=[
            PriceChangeItem(sku="GLA-1KG", name="Gula pasir 1 kg", old_price=17500, new_price=18000, changed_at=changed_at),
            PriceChangeItem(sku="TLR-1KG", name="Telur ayam 1 kg", old_price=29000, new_price=30000, changed_at=changed_at),
        ])
        text = (f"{label} ada 2 perubahan harga: Gula pasir 1 kg menjadi Rp18.000 dan Telur ayam 1 kg menjadi Rp30.000. "
                "Harga baru berlaku di kedua cabang.")

    fallback = scenario == "fallback"
    if fallback:
        text += FALLBACK_NOTE
    return SummaryData(type=kind, period=period, facts=facts, text=text, fallback=fallback, generated_at=now)
