# SRC Alfiamart: Starter Tim FS (Tim A26-CS165)

Fondasi untuk langkah **FS-01 sampai FS-11**: skema database, kontrak API, backend (Express + PostgreSQL),
dan front-end (React + Vite + Tailwind):
- **Dasbor owner:** login, daftar produk, tambah/ubah dengan pratinjau, impor CSV, riwayat harga, pembatalan perubahan terakhir.
- **Kasir (PWA, offline-first):** pilih produk, keranjang, metode bayar dicatat; transaksi tetap tersimpan saat internet putus
  dan dikirim otomatis saat koneksi kembali, dengan status Menunggu kirim / Terkirim / Gagal.
- **Katalog publik:** daftar produk dan harga terbaru untuk pelanggan, tanpa login.

```
db/schema.sql        skema PostgreSQL (satu sumber data tunggal)
docs/openapi.yaml    kontrak API v1 (buka di editor.swagger.io)
backend/             Express + pg + Joi + JWT
frontend/            React + Vite + Tailwind + Axios (dasbor owner)
```

## Menjalankan di lokal
```bash
cd backend
cp .env.example .env        # isi DATABASE_URL dan JWT_SECRET
npm install
npm run db:init             # membuat tabel
npm run db:seed             # data CONTOH (dummy) + akun owner dan kasir
npm run dev                 # http://localhost:3000/api/v1/health
```
Akun contoh dari seed: `owner@example.com` dan `kasir@example.com`, kata sandi `password123`
(hanya untuk pengembangan; jangan dipakai di server publik).

### Front-end
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (permintaan /api diteruskan ke backend di :3000)
npm run build               # hasil di dist/ untuk deploy (Netlify/Cloudflare Pages)
```
Saat deploy, isi `VITE_API_URL` dengan alamat API publik (lihat `frontend/.env.example`) dan atur `CORS_ORIGIN` di backend ke alamat front-end.
Service worker (agar aplikasi terbuka saat offline) hanya aktif pada build produksi:
```bash
npm run build && npm run preview     # http://localhost:4173 (backend tetap di :3000)
```
Cara mencoba mode offline: buka `/kasir` sekali saat online, lalu di DevTools pilih Network → Offline dan muat ulang halaman.
Catat transaksi, kembalikan ke Online, dan transaksi terkirim otomatis.

Tes otomatis backend (13 skenario, butuh PostgreSQL; **menghapus isi tabel**, jadi pakai database uji):
```bash
DATABASE_URL=postgres://... JWT_SECRET=x SERVICE_API_KEY=svc npm test
```

## Keputusan desain yang perlu dipahami tim
- **Satu database.** Harga diubah sekali, kasir dan katalog membaca tabel `products` yang sama.
- **Harga = integer rupiah.** Tidak ada desimal.
- **Peran:** `owner` (kelola semuanya), `kasir` (transaksi), pelanggan tidak login dan memakai `GET /catalog`.
- **Offline kasir.** Setiap transaksi dibuat di perangkat dengan `client_id` (UUID). Antrean dikirim lewat
  `POST /transactions/batch`; transaksi yang sudah pernah masuk dilaporkan `duplicate`, bukan disimpan ganda.
  Hasil per transaksi (`synced`, `duplicate`, `failed`) dipakai untuk status berhasil/tertunda/gagal di UI.
- **Harga saat transaksi offline.** Kasir mengirim `unit_price` yang ia lihat; server menghitung ulang `subtotal`
  dan `total`, dan menyimpan salinan nama dan harga pada item transaksi.
- **Riwayat harga.** Setiap perubahan tercatat di `price_history`. Hanya perubahan **terakhir** per produk yang bisa dibatalkan.
- **Hapus produk = nonaktifkan** (`is_active = false`), agar riwayat transaksi tetap utuh.
- **Impor massal** menerima JSON baris `{sku, name, category?, unit?, price}`; front-end yang mem-parse CSV/Excel
  (mis. papaparse, SheetJS). Baris salah dilaporkan, baris valid tetap diproses.
- **Untuk DS dan AE:** `GET /export/products` dan `GET /export/transactions` (header `X-Service-Key`).
  Minta kuncinya ke FS dan jangan masukkan ke repo.

## Cara kerja mode offline kasir
- **Setiap transaksi ditulis dulu ke IndexedDB** (`outbox`) dengan `client_id` unik, baru dikirim. Jadi tidak ada transaksi yang hilang
  walaupun tab ditutup atau internet putus di tengah pengiriman.
- **Daftar produk dan harga** disalin ke IndexedDB setiap kali online. Saat offline, kasir memakai salinan terakhir dan
  `unit_price` yang ia lihat dikirim apa adanya (harga transaksi = harga yang dilihat kasir).
- **Sinkronisasi** (`src/offline/sync.js`): saat transaksi disimpan, saat koneksi kembali (`online`), tiap 20 detik selama ada yang tertunda,
  atau lewat tombol "Kirim sekarang". Gangguan jaringan tidak mengubah status; penolakan server menjadi **Gagal** beserta alasannya
  (kasir bisa Coba lagi atau Buang).
- **Kirim ulang aman:** server menandai transaksi yang sudah pernah masuk sebagai `duplicate`, jadi tidak tersimpan ganda.
- **Keterbatasan yang perlu dipahami:** (1) aplikasi dan daftar harga harus dibuka sekali saat online di perangkat itu;
  (2) login pertama butuh internet, setelah itu sesi tetap terbaca offline; (3) token berlaku 12 jam, bila habis saat online
  kasir diminta login ulang dan transaksi di perangkat tetap aman, lalu terkirim atas nama akun yang login berikutnya;
  (4) pembatalan/penghapusan data browser menghapus antrean yang belum terkirim.

## Urutan pengerjaan FS berikutnya
1. Tinjau `docs/openapi.yaml` bersama DS dan AE, lalu sepakati (FS-01).
2. Buat database (Neon), deploy backend (Render) dan front-end (Netlify/Cloudflare Pages), lalu uji URL publik di ponsel (FS-14).
3. Hubungkan layanan AE (chatbot) dan dasbor DS ke aplikasi lewat back-end (FS-12), serta penanganan error layanan tersebut (FS-13).
4. Uji menyeluruh bersama PIC UMKM, panduan penggunaan, dan dokumentasi (FS-15).

## Belum ada di starter ini (sengaja)
Impor langsung `.xlsx` (saat ini CSV; Excel bisa disimpan sebagai CSV), deploy, rate limiting login, pencetakan struk,
serta penghubung chatbot (AE) dan dasbor (DS) ke web.
Bagian itu menyusul sesuai langkah di spreadsheet urutan pengerjaan.

## Catatan teknis front-end
- Token login disimpan di `localStorage`; sesi yang habis otomatis mengembalikan pengguna ke halaman login.
- Pesan error dari API (`error.message` dan `details`) ditampilkan apa adanya lewat `errorMessage()` di `src/api/client.js`.
- Font (Instrument Sans, Barlow Condensed) dimuat dari Google Fonts; bila offline, aplikasi memakai font sistem.
