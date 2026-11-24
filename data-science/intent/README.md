# Dataset Intent Chatbot Owner – SRC Alfiamart

> **DATA SINTETIS – DRAF v0.1 (24 Nov 2026).** Ini bukan percakapan asli. Dataset disusun oleh tim Data Science
> (Fadhillah) untuk melatih model klasifikasi intent tim AE, dan masih menunggu persetujuan Rafiq.

| File | Isi |
|---|---|
| `intent_dataset.csv` | 780 kalimat berlabel intent dan entitas, sudah dibagi train/test |
| `build_intent_dataset.py` | Generator dataset. Menjalankannya ulang menghasilkan file yang sama persis (seed 42) |

## Ringkasan

Pengguna chatbot: **owner saja**. Ada 6 intent dengan 130 kalimat per intent, jadi kelasnya seimbang.

| Intent | Train | Test | Total | Grup train/test |
|---|---:|---:|---:|---|
| `tanya_produk` | 103 | 27 | 130 | 22 / 6 |
| `ubah_harga` | 105 | 25 | 130 | 21 / 5 |
| `cek_penjualan` | 105 | 25 | 130 | 22 / 5 |
| `analisis_bisnis` | 102 | 28 | 130 | 22 / 6 |
| `tanya_panduan` | 104 | 26 | 130 | 32 / 8 |
| `di_luar_konteks` | 103 | 27 | 130 | 32 / 8 |
| **Total** | **622** | **158** | **780** | |

## Intent dan rutenya

| Intent | Arti | Contoh | Diarahkan ke |
|---|---|---|---|
| `tanya_produk` | Harga, stok, atau info produk **saat ini** | "brp harga gula?", "stok beras di cabang 2 sisa brp?" | Data produk (API/RAG) |
| `ubah_harga` | **Perintah** mengubah atau membatalkan harga produk tertentu | "ganti harga gula jd 18rb", "batalin perubahan harga telur" | API back-end |
| `cek_penjualan` | Minta **angka/fakta** penjualan dan riwayat (transaksi, perubahan harga) | "omzet hari ini brp?", "kapan terakhir harga gula diubah?" | API back-end |
| `analisis_bisnis` | Minta **penjelasan, saran, atau prediksi** | "kenapa omzet minggu ini turun?", "prediksi penjualan minggu depan" | LLM + hasil analisis DS |
| `tanya_panduan` | Cara memakai aplikasi atau fiturnya | "gimana cara impor CSV?", "status gagal artinya apa?" | RAG FAQ/panduan |
| `di_luar_konteks` | Di luar urusan toko | "harga emas hari ini?", "bikinin pantun" | Ditolak dengan sopan |

Perubahan dari project plan: intent `keluhan` dihapus. Karena bot hanya dipakai owner, alur "keluhan → diteruskan ke
owner" tidak relevan lagi. Sebagai gantinya ada `analisis_bisnis` dan `tanya_panduan`. Checklist hanya mewajibkan
minimal 4 intent.

## Aturan pelabelan untuk kalimat yang mirip

- **tanya_produk vs cek_penjualan:** kondisi produk *sekarang* (harga, stok) → `tanya_produk`. Yang *sudah terjadi*
  (terjual, omzet, riwayat) → `cek_penjualan`.
- **cek_penjualan vs analisis_bisnis:** minta angka atau daftar ("berapa", "apa", "kapan", "siapa") → `cek_penjualan`.
  Minta alasan, saran, tren, ringkasan kondisi, atau prediksi ("kenapa", "penyebab", "saran", "strategi",
  "prediksi") → `analisis_bisnis`.
- **ubah_harga vs tanya_panduan:** perintah untuk produk tertentu ("ubah harga gula jadi 18rb") → `ubah_harga`.
  Pertanyaan cara melakukannya di aplikasi ("cara ubah harga gimana?") → `tanya_panduan`.
- **tanya_panduan vs di_luar_konteks:** "cara ..." tentang aplikasi ini → `tanya_panduan`. "Cara masak rendang",
  "cara bikin website" → `di_luar_konteks`.
- **tanya_produk vs di_luar_konteks:** harga barang yang dijual toko → `tanya_produk`. Harga emas, tiket, saham,
  atau HP → `di_luar_konteks`.
- Riwayat perubahan harga masuk `cek_penjualan`, sesuai rumusan "cek penjualan/riwayat" di project plan.

Contoh "pasangan sulit" seperti di atas sengaja dimasukkan supaya model tidak hanya menghafal kata kunci
("harga", "kenapa", "cara").

## Data dictionary

| Kolom | Tipe | Keterangan | Contoh |
|---|---|---|---|
| `id` | teks | ID unik baris | `INT-0001` |
| `text` | teks | Kalimat pesan owner (input model) | `ganti hrg gula jd 18rb` |
| `intent` | teks | Label intent (target model), salah satu dari 6 intent di atas | `ubah_harga` |
| `produk` | teks | Nama produk **persis seperti tertulis** di `text`. Kosong jika tidak ada | `gula` |
| `harga` | angka | Harga **baru** dalam rupiah, sudah dinormalisasi. Kosong jika tidak ada | `18000` |
| `periode` | teks | Rentang waktu yang dinormalisasi (daftar di bawah). Kosong jika tidak ada | `minggu_ini` |
| `cabang` | teks | Cabang yang dinormalisasi: `alfiamart1` / `alfiamart2`. Kosong jika tidak ada | `alfiamart2` |
| `group_id` | teks | ID kalimat dasar. Semua variasinya punya ID yang sama | `ubah_harga-01` |
| `sumber` | teks | `manual` = kalimat dasar tanpa slot. `template` = kalimat dasar + isian slot. `augmentasi` = variasi gaya chat | `augmentasi` |
| `split` | teks | `train` atau `test` | `train` |

**Nilai entitas:**
- `periode`: `hari_ini`, `kemarin`, `7_hari_terakhir`, `minggu_ini`, `minggu_lalu`, `bulan_ini`, `bulan_lalu`, ditambah
  periode ke depan untuk prediksi: `besok`, `minggu_depan`, `bulan_depan`. Contoh variasi tulisannya: "mgg ini",
  "kmrn", "seminggu terakhir", "pekan lalu".
- `cabang`: ditulis sebagai "cabang 2", "cabang dua", "toko 2", "alfiamart 2", atau "cab 2". Sesuai dua akun cabang
  di aplikasi.
- `harga`: ditulis dalam berbagai gaya, misalnya `18000`, `18.000`, `Rp18.000`, `18rb`, `18 ribu`, `18k`,
  `delapan belas ribu`, `3,5rb`. Harga berlaku untuk semua cabang, jadi kalimat `ubah_harga` tidak memakai entitas cabang.
- Entitas hanya diisi untuk intent yang membutuhkannya. Kalimat `di_luar_konteks` seperti "harga emas hari ini"
  sengaja dibiarkan tanpa entitas.

## Cara dataset dibuat

1. Kalimat dasar ditulis manual per intent: 26–28 kalimat untuk intent yang memakai slot, 40 untuk `tanya_panduan`
   dan `di_luar_konteks`.
2. Slot `{produk}`, `{harga}`, `{periode}`, dan `{cabang}` diisi secara acak, sehingga entitas otomatis terlabeli.
   Harga baru dibuat dari harga dasar produk ±500–3.000.
3. Variasi gaya chat dibuat dengan augmentasi ringan: huruf kecil, singkatan ("brp", "hrg", "yg", "gmn"),
   partikel ("dong", "ya", "bot,"), penghapusan tanda baca, dan typo satu huruf. Kata milik nama produk dan harga
   tidak pernah diubah.
4. Duplikat dibuang setelah kalimat dinormalisasi (huruf kecil, tanpa tanda baca).
5. Data dibagi train/test.

## Pencegahan kebocoran data

- Pembagian dilakukan **per `group_id`**, bukan per baris, dan bertingkat per intent: ±20% grup masuk test.
  Variasi dari kalimat dasar yang sama tidak pernah ada di train dan test sekaligus, jadi skor uji mengukur
  kemampuan model memahami pola kalimat **baru**.
- Nama produk boleh muncul di train dan test. Ini disengaja: produk muncul di 4 intent berbeda, sehingga nama
  produk bukan petunjuk intent.
- Generator memvalidasi secara otomatis bahwa setiap nama produk ada di teksnya, tidak ada grup yang muncul di
  dua split, dan tidak ada duplikat.
- **Untuk tim AE:** kalau ingin menambah augmentasi atau melakukan tuning, lakukan hanya di data `train`.

## Cara pakai

```python
import pandas as pd

df = pd.read_csv("intent_dataset.csv", keep_default_na=False)
train, test = df[df.split == "train"], df[df.split == "test"]
X_train, y_train = train.text, train.intent
X_test, y_test = test.text, test.intent
```

Untuk cross-validation di data train, gunakan `GroupKFold` dengan `groups=train.group_id` agar tetap bebas kebocoran.

## Membuat ulang dataset

```bash
python build_intent_dataset.py                          # daftar produk contoh, seed 42
python build_intent_dataset.py --produk produk_asli.csv # pakai daftar produk asli (kolom: nama, harga)
python build_intent_dataset.py --target 200             # jumlah kalimat per intent
```

File `--produk` bisa memakai format yang sama dengan file impor aplikasi (`frontend/public/contoh-impor.csv`).

## Keterbatasan

- **Sintetis.** Skor model pada data uji ini kemungkinan lebih tinggi daripada saat dipakai owner sungguhan.
  Begitu ada pesan asli dari owner, misalnya saat demo, tambahkan sebagai data uji.
- **Nama produk masih contoh**, bukan daftar produk asli toko. Ganti dengan `--produk` setelah data dari PIC tersedia.
- **"Untung" dijawab sebagai omzet.** Database hanya menyimpan harga jual, tanpa harga modal.
- Belum mencakup **sapaan atau terima kasih** ("halo", "makasih"). Sebaiknya ditangani aturan sederhana sebelum
  model, atau ditambahkan sebagai intent baru.
- Belum mencakup **satu pesan dengan dua permintaan** ("cek omzet hari ini terus ubah harga gula") dan
  **perubahan harga relatif** ("naikin 1000"). `harga` selalu berarti harga baru.
- Entitas disimpan per kolom, **tanpa posisi kata (span)**. Kalau tim AE ingin melatih model NER, kolom
  start/end perlu ditambahkan.
- `periode` hanya diisi untuk ungkapan di daftar di atas. Kata "tadi" dan "sekarang" tidak dilabeli.

## Perlu dikonfirmasi dengan tim AE

1. Daftar 6 intent ini, termasuk penggantian `keluhan`.
2. Apakah format entitas per kolom sudah cukup, atau perlu span untuk NER.
3. Cara menangani sapaan dan ucapan terima kasih.
