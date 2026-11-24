# Layanan AI SRC Alfiamart (stub)

**Status: stub.** Bentuk request dan response sudah sesuai kontrak, tapi isi jawabannya masih contoh.
Gunanya supaya Express (Ammar) dan dasbor (Iqbal) bisa disambungkan sekarang, sebelum model intent (Rafiq) dan LLM siap.

## Menjalankan di lokal

Butuh Python 3.11 atau lebih baru.

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows (PowerShell)
# source .venv/bin/activate     # Mac/Linux
pip install -r requirements-dev.txt
copy .env.example .env          # Windows; Mac/Linux: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- Cek hidup: http://localhost:8000/health
- Dokumentasi dan uji coba (Swagger): http://localhost:8000/docs. Klik endpoint, lalu "Try it out", isi kolom `x-internal-key` dengan nilai `INTERNAL_API_KEY` di `.env`.
- Tes otomatis: `pytest`

## Struktur

| File | Isi | Materi |
|---|---|---|
| `app/main.py` | Membuat aplikasi, mendaftarkan endpoint, `/health`, aturan global di Swagger | Sesi 1, 5 |
| `app/schemas.py` | **Kontrak dalam bentuk kode**: semua bentuk request dan response | Sesi 2a, 2b, 3 |
| `app/errors.py` | Format error amplop, termasuk mengganti 422 bawaan FastAPI menjadi 400 | Sesi 2c |
| `app/security.py` | Pemeriksaan `X-Internal-Key` | Sesi 5 |
| `app/periods.py` | Nama periode (`kemarin`, `minggu_lalu`, ...) menjadi rentang waktu WIB | Sesi 3 |
| `app/stub.py` | Jawaban contoh dan simulasi gangguan. **Bagian yang nanti diganti** | – |
| `app/routers/chat.py` | `POST /v1/chat` | Sesi 2 |
| `app/routers/summaries.py` | `GET /v1/summaries` | Sesi 3 |
| `app/config.py` | Membaca `.env`. Layanan menolak jalan kalau `INTERNAL_API_KEY` kosong | Sesi 5 |
| `tests/` | 30 tes kontrak dan perhitungan periode | Semua |

## Endpoint

| Endpoint | Kunci | Keterangan |
|---|---|---|
| `GET /health` | Tidak | Untuk Render dan pengecekan sebelum demo |
| `POST /v1/chat` | `X-Internal-Key` | Satu pintu untuk semua pesan owner |
| `GET /v1/summaries?type=sales\|price_changes&period=kemarin` | `X-Internal-Key` | Kartu ringkasan di dasbor |

Stub memilih intent dengan aturan kata kunci sementara, misalnya:

| Contoh pesan | Intent | Yang muncul |
|---|---|---|
| "harga beras berapa?" | `tanya_produk` | `sources` produk |
| "naikin harga gula jadi 18rb" | `ubah_harga` | `action: price_proposal` |
| "batalin perubahan harga telur" | `ubah_harga` | `action: price_revert` |
| "omzet kemarin berapa?" | `cek_penjualan` | – |
| "kenapa omzet turun?" | `analisis_bisnis` | – |
| "cara impor CSV gimana?" | `tanya_panduan` | `sources` panduan |
| "bikinin pantun" | `di_luar_konteks` | Penolakan sopan |

## Menguji gangguan (untuk Express)

Kirim header `X-Stub-Scenario` (aktif bila `STUB_SCENARIOS=true`):

| Nilai | Yang terjadi | Yang seharusnya dilakukan Express |
|---|---|---|
| `fallback` | 200, `fallback: true` (simulasi LLM gagal) | Tampilkan `reply` seperti biasa |
| `no_data` | 200, `fallback: true`, tanpa angka; ringkasan `facts: null` | Tampilkan `reply`/`text`; sembunyikan kotak angka |
| `slow` | Baru menjawab setelah 20 detik | Berhenti menunggu di detik 15, tampilkan jawaban cadangan sendiri |
| `unavailable` | 503 `MODEL_UNAVAILABLE` | Tampilkan "Asisten sedang bersiap, coba lagi" |
| `crash` | 500 `INTERNAL_ERROR` | Tampilkan jawaban cadangan, catat di log |

## Yang nanti diganti (kontrak tetap sama)

| Sekarang (stub) | Nanti |
|---|---|
| `stub_classify()` | Model intent dan pengambil entitas (Rafiq) |
| `build_chat_data()` | Jalur per intent, klien data `/export/*`, LLM (Rafiq dan Septian) |
| `build_summary()` | Klien data, pandas, LLM, cache (Septian) |
| `/health` → `model_intent: "stub"` | `"loaded"` setelah model dimuat |

## Aturan

- `.env` tidak boleh di-commit (sudah ada di `.gitignore`). Bagikan `INTERNAL_API_KEY` ke Ammar lewat chat pribadi.
- Di server publik, isi `STUB_SCENARIOS=false`.
- Mengubah `app/schemas.py` berarti mengubah kontrak. Menambah field opsional aman; mengganti nama atau menghapus field harus disepakati dulu dengan Ammar.
- CORS sengaja tidak diaktifkan: layanan ini hanya dipanggil Express, tidak pernah dari browser.

## Masih perlu disepakati

- Label intent final dengan Rafiq (sekarang mengikuti dataset Fadhillah).
- Asumsi periode dengan Fadhillah: minggu dimulai Senin, "7 hari terakhir" termasuk hari ini.
- Batas tunggu Express 15 detik dengan Ammar.
- Permintaan ke FS: stok per cabang di `/export/products`, cabang per transaksi di `/export/transactions`, endpoint baru `/export/price-history`, dan nama cabang yang tampil ke owner.
