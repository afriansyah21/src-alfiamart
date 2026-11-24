"""
Generator dataset intent chatbot owner SRC Alfiamart (DATA SINTETIS).

Cara kerja:
1. Kalimat dasar (template) ditulis manual per intent. Satu template = satu group_id.
2. Template diisi slot {produk}, {harga}, {periode}, {periode_depan}, {cabang}
   sehingga entitas otomatis terlabeli.
3. Variasi dibuat dengan augmentasi ringan: huruf kecil, singkatan chat,
   partikel ("dong", "ya", "bot,"), hapus tanda baca, dan typo.
4. Duplikat (setelah dinormalisasi) dibuang.
5. Pembagian train/test dilakukan PER group_id, bukan per baris, supaya variasi
   dari kalimat dasar yang sama tidak bocor ke train dan test sekaligus.

Jalankan dari folder ini:
    python build_intent_dataset.py
    python build_intent_dataset.py --produk daftar_produk.csv   # kolom wajib: nama, harga
Format --produk sama dengan file impor aplikasi (frontend/public/contoh-impor.csv).
"""
import argparse
import csv
import random
import re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
KOLOM = ["id", "text", "intent", "produk", "harga", "periode", "cabang", "group_id", "sumber", "split"]
TEST_RATIO = 0.2  # porsi group_id per intent yang masuk data uji

# Contoh produk toko sembako + harga dasar (rupiah). BUKAN daftar produk asli UMKM;
# ganti lewat --produk begitu ekspor produk asli dari PIC tersedia.
PRODUK_CONTOH = [
    ("gula pasir", 18000), ("gula", 18000), ("minyak goreng", 20000),
    ("minyak goreng 2 liter", 38000), ("beras 5 kg", 75000), ("beras", 15000),
    ("telur ayam", 30000), ("telur", 30000), ("indomie goreng", 3500),
    ("mie instan", 3500), ("kopi sachet", 2000), ("kopi kapal api", 2000),
    ("teh pucuk", 4000), ("aqua 600ml", 4000), ("air galon", 22000),
    ("susu kental manis", 13000), ("susu bubuk", 45000), ("sabun cuci piring", 16000),
    ("sabun mandi", 4500), ("deterjen", 5000), ("gas 3 kg", 22000),
    ("tepung terigu", 13000), ("kecap manis", 10000), ("saos sambal", 9000),
    ("garam", 4000), ("pasta gigi", 12000), ("shampo sachet", 1000),
    ("roti tawar", 16000), ("mentega", 9000), ("biskuit", 8000),
]

# Nilai entitas yang dinormalisasi -> variasi tulisan di kalimat
PERIODE = {
    "hari_ini": ["hari ini", "hr ini"],
    "kemarin": ["kemarin", "kmrn", "kemaren"],
    "7_hari_terakhir": ["7 hari terakhir", "seminggu terakhir", "tujuh hari terakhir"],
    "minggu_ini": ["minggu ini", "mgg ini", "pekan ini"],
    "minggu_lalu": ["minggu lalu", "minggu kemarin", "pekan lalu"],
    "bulan_ini": ["bulan ini", "bln ini"],
    "bulan_lalu": ["bulan lalu", "bulan kemarin", "bln lalu"],
}
PERIODE_DEPAN = {
    "besok": ["besok", "bsk"],
    "minggu_depan": ["minggu depan", "mgg depan", "pekan depan"],
    "bulan_depan": ["bulan depan", "bln depan"],
}
CABANG = {
    "alfiamart1": ["cabang 1", "cabang satu", "toko 1", "alfiamart 1", "cab 1"],
    "alfiamart2": ["cabang 2", "cabang dua", "toko 2", "alfiamart 2", "cab 2"],
}

TEMPLATES = {
    # Harga, stok, dan info produk SAAT INI
    "tanya_produk": [
        "Berapa harga {produk} sekarang?",
        "Harga {produk} berapa ya?",
        "{produk} dijual berapa di toko?",
        "Cek harga {produk} dong",
        "Tolong infoin harga jual {produk}",
        "Sekarang {produk} harganya berapa?",
        "Harga {produk} di sistem udah berapa?",
        "{produk} sekarang dijual berapaan?",
        "Harga eceran {produk} berapa?",
        "Mau tau harga terbaru {produk}",
        "{produk} masih ada stoknya?",
        "Stok {produk} di {cabang} tinggal berapa?",
        "Cek stok {produk} di {cabang}",
        "Di {cabang} {produk} masih ada nggak?",
        "Sisa {produk} di {cabang} berapa?",
        "Stok {produk} masih banyak nggak?",
        "{produk} udah habis belum?",
        "Berapa stok {produk} di semua cabang?",
        "Ada {produk} di daftar produk nggak?",
        "Kode barang {produk} apa?",
        "{produk} masuk kategori apa?",
        "Satuan jual {produk} apa?",
        "Info produk {produk} dong",
        "Coba lihat detail {produk}",
        "Harga {produk} sama di semua cabang kan?",
        "Produk apa aja yang stoknya mau habis di {cabang}?",
        "Produk apa aja yang stoknya kosong?",
        "Ada produk apa aja di kategori sembako?",
    ],
    # Perintah mengubah / membatalkan harga produk tertentu
    "ubah_harga": [
        "Ubah harga {produk} jadi {harga}",
        "Ganti harga {produk} ke {harga}",
        "Tolong naikin harga {produk} jadi {harga}",
        "Turunin harga {produk} ke {harga}",
        "Harga {produk} sekarang {harga} ya, tolong diupdate",
        "Update harga {produk} jadi {harga}",
        "Set harga jual {produk} {harga}",
        "Mulai sekarang {produk} dijual {harga}",
        "{produk} naik jadi {harga}, tolong ubah",
        "Harga {produk} dari pusat jadi {harga}, update ya",
        "Benerin harga {produk}, harusnya {harga}",
        "Koreksi harga {produk} jadi {harga}",
        "{produk} jadi {harga}",
        "Perbarui harga {produk} menjadi {harga}",
        "Harga baru {produk}: {harga}",
        "Bisa tolong ubah harga {produk} jadi {harga}?",
        "Naikkan harga {produk} ke {harga} di semua cabang",
        "Turunkan harga {produk} jadi {harga} buat promo",
        "Harga {produk} salah input, balikin ke {harga}",
        "Ganti harga {produk} dong, jadi {harga}",
        "Tolong ganti harga {produk}",
        "Mau ubah harga {produk}",
        "Harga {produk} perlu diganti nih",
        "Batalin perubahan harga {produk} yang terakhir",
        "Kembalikan harga {produk} ke harga sebelumnya",
        "Undo perubahan harga {produk} tadi",
    ],
    # Minta ANGKA / FAKTA penjualan dan riwayat (transaksi, perubahan harga)
    "cek_penjualan": [
        "Berapa omzet {periode}?",
        "Total penjualan {periode} berapa?",
        "Penjualan {periode} dapet berapa?",
        "Ada berapa transaksi {periode}?",
        "Produk apa yang paling laku {periode}?",
        "Barang paling laris {periode} apa aja?",
        "5 produk terlaris {periode} apa aja?",
        "{produk} kejual berapa {periode}?",
        "Berapa banyak {produk} yang terjual {periode}?",
        "Omzet {cabang} {periode} berapa?",
        "Penjualan di {cabang} {periode} totalnya berapa?",
        "Rata-rata belanja per transaksi {periode} berapa?",
        "Tunjukin riwayat transaksi {periode}",
        "Lihat riwayat transaksi {cabang} {periode}",
        "Transaksi terbesar {periode} berapa?",
        "Total pemasukan {periode} berapa?",
        "Rekap penjualan {periode} dong",
        "Minta laporan penjualan {periode}",
        "Cabang mana yang omzetnya paling gede {periode}?",
        "Jam berapa toko paling rame {periode}?",
        "Berapa transaksi yang dibayar pakai QRIS {periode}?",
        "Metode bayar paling banyak dipakai {periode} apa?",
        "Riwayat perubahan harga {produk}",
        "Kapan terakhir harga {produk} diubah?",
        "Siapa yang terakhir ubah harga {produk}?",
        "Ada perubahan harga apa aja {periode}?",
        "Omzet {periode} sudah tembus sejuta belum?",
    ],
    # Minta PENJELASAN, SARAN, atau PREDIKSI (dijawab LLM + hasil analisis DS)
    "analisis_bisnis": [
        "Kenapa omzet {periode} turun?",
        "Kenapa penjualan {periode} lebih sepi?",
        "Kenapa untung {periode} menurun?",
        "Apa penyebab penjualan {produk} turun {periode}?",
        "Kok {produk} jarang laku sekarang?",
        "Kenapa {cabang} lebih sepi dari cabang lain?",
        "Kenapa omzet {cabang} beda jauh sama cabang lain?",
        "Kenapa transaksi {periode} lebih sedikit dari biasanya?",
        "Apa yang bikin {produk} laris {periode}?",
        "Jelasin kenapa {periode} rame banget",
        "Produk apa yang sebaiknya dinaikin harganya?",
        "Harga {produk} perlu diturunin nggak biar laku?",
        "Rekomendasi harga yang pas buat {produk} berapa?",
        "Apakah naikin harga {produk} bakal bikin penjualan turun?",
        "Saran dong biar penjualan naik",
        "Gimana caranya biar omzet {cabang} naik?",
        "Strategi apa biar {produk} lebih laku?",
        "Perlu bikin promo apa {periode_depan}?",
        "Prediksi penjualan {periode_depan} berapa?",
        "Perkiraan omzet {periode_depan} kira-kira berapa?",
        "{produk} perlu restock berapa buat {periode_depan}?",
        "Produk apa yang perlu distok lebih banyak {periode_depan}?",
        "Produk mana yang kurang laku dan sebaiknya dikurangi stoknya?",
        "Analisis penjualan {periode} dong",
        "Tren penjualan {produk} {periode} gimana?",
        "Ringkasin kondisi toko {periode}",
        "Kasih insight penjualan {periode}",
        "Performa toko {periode} gimana, ada masalah nggak?",
    ],
    # Cara memakai aplikasi / fitur (dijawab RAG FAQ & panduan)
    "tanya_panduan": [
        "Gimana cara impor produk dari Excel?",
        "Cara upload file CSV produk gimana?",
        "Format CSV buat impor kolomnya apa aja?",
        "Kalau impor ada baris yang ditolak, kenapa ya?",
        "Cara batalin perubahan harga gimana?",
        "Gimana cara ubah harga lewat aplikasi?",
        "Apa itu pratinjau sebelum simpan harga?",
        "Cara nambah produk baru gimana?",
        "Gimana cara hapus produk?",
        "Cara nonaktifin produk biar nggak muncul di kasir?",
        "Bisa tambah kategori produk baru nggak?",
        "Cara ngatur stok per cabang gimana?",
        "Kalau internet mati, transaksi kasir aman nggak?",
        "Transaksi offline nanti kesinkron sendiri?",
        "Status sinkronisasi gagal itu artinya apa?",
        "Kalau sinkron gagal harus ngapain?",
        "Bedanya status tertunda sama gagal apa?",
        "Gimana cara cek status sinkronisasi?",
        "Kenapa transaksi tadi statusnya tertunda?",
        "Harga yang diubah langsung muncul di kasir nggak?",
        "Kenapa harga di katalog belum berubah?",
        "Katalog pelanggan bisa dibuka lewat HP?",
        "Cara lihat riwayat perubahan harga di menu mana?",
        "Menu dasbor penjualan ada di mana?",
        "Cara baca grafik di dasbor gimana?",
        "Filter di dasbor fungsinya buat apa?",
        "Gimana cara upload data penjualan ke dasbor?",
        "Fitur prediksi penjualan itu dihitung dari mana?",
        "Gimana cara bikin akun kasir baru?",
        "Login kasir pakai apa?",
        "Cara ganti password gimana?",
        "Kenapa kasir nggak bisa buka halaman ubah harga?",
        "Cara install aplikasi kasir di HP gimana?",
        "Data transaksi aman nggak kalau HP kasir mati?",
        "Kok aplikasinya lemot?",
        "Cara pakai chatbot ini gimana?",
        "Bot ini bisa bantu apa aja?",
        "Gimana cara pakai bot lewat Telegram?",
        "Perintah apa aja yang bisa aku kirim ke bot?",
        "Cara export laporan penjualan gimana?",
    ],
    # Di luar usaha toko; termasuk "hard negative" yang mirip intent lain
    # (harga emas/tiket, "kenapa ...", "cara ... gimana", "ubah ...")
    "di_luar_konteks": [
        "Cuaca besok gimana?",
        "Bikinin pantun dong",
        "Siapa presiden Indonesia sekarang?",
        "Harga emas hari ini berapa?",
        "Kurs dollar sekarang berapa?",
        "Harga bitcoin naik nggak?",
        "Harga iPhone terbaru berapa?",
        "Harga tiket pesawat ke Jakarta berapa?",
        "Saham BBCA hari ini naik nggak?",
        "Resep nasi goreng yang enak gimana?",
        "Gimana cara masak rendang?",
        "Cara bikin website gimana?",
        "Ubah bahasa HP ke bahasa Inggris gimana?",
        "Tolong ubah foto ini jadi kartun",
        "Kenapa langit warnanya biru?",
        "Kenapa bensin naik terus?",
        "Kenapa kucingku nggak mau makan?",
        "Rekomendasi film buat nonton malam ini",
        "Skor bola tadi malam berapa?",
        "Siapa yang menang piala dunia terakhir?",
        "Tolong kerjain PR matematika anakku",
        "Ceritain lelucon dong",
        "Terjemahin selamat pagi ke bahasa Inggris",
        "Jadwal sholat hari ini jam berapa?",
        "Berapa ongkir kirim paket ke Surabaya?",
        "Tips diet sehat apa aja?",
        "Tolong tulisin surat lamaran kerja",
        "Lagu yang lagi viral apa?",
        "Kapan lebaran tahun depan?",
        "Rekomendasi tempat liburan di Bali",
        "Apa ibu kota Australia?",
        "Ramalan zodiak hari ini apa?",
        "Berita terbaru hari ini apa?",
        "Kamu suka kopi nggak?",
        "Gimana cara daftar BPJS?",
        "Hitungin 125 kali 48",
        "Cara benerin motor mogok gimana?",
        "Bikinin puisi tentang hujan",
        "Kamu manusia atau robot?",
        "Kenapa HP aku cepet panas?",
    ],
}

# Singkatan gaya chat (kata baku -> pilihan singkatan)
SINGKATAN = {
    "berapa": ["brp"], "harga": ["hrg"], "yang": ["yg"], "tidak": ["tdk", "gak"],
    "nggak": ["ga", "gak", "ngga"], "sudah": ["udah", "sdh"], "udah": ["udh", "dah"],
    "jadi": ["jd"], "minggu": ["mgg"], "bulan": ["bln"], "hari": ["hr"],
    "kemarin": ["kmrn", "kemaren"], "gimana": ["gmn", "gmana"], "bagaimana": ["gimana", "gmn"],
    "tolong": ["tlg"], "dengan": ["dgn"], "untuk": ["utk"], "sekarang": ["skrg", "skrang"],
    "saja": ["aja"], "banget": ["bgt"], "cabang": ["cab"], "transaksi": ["trx"],
    "kenapa": ["knp", "napa"], "bisa": ["bs"], "lagi": ["lg"], "juga": ["jg"],
    "belum": ["blm"], "kalau": ["kalo", "klo"], "sama": ["sm"], "dari": ["dr"],
    "omzet": ["omset"], "dong": ["donk"],
}

SLOT_RE = re.compile(r"\{(\w+)\}")
TOKEN_RE = re.compile(r"^(\W*)(.*?)(\W*)$")


def terbilang(n: int) -> str:
    """Angka -> kata bahasa Indonesia (0 < n < 1.000.000)."""
    satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan",
              "sembilan", "sepuluh", "sebelas"]

    def ekor(sisa):
        return " " + terbilang(sisa) if sisa else ""

    if n < 12:
        return satuan[n]
    if n < 20:
        return satuan[n - 10] + " belas"
    if n < 100:
        return satuan[n // 10] + " puluh" + ekor(n % 10)
    if n < 200:
        return "seratus" + ekor(n - 100)
    if n < 1000:
        return satuan[n // 100] + " ratus" + ekor(n % 100)
    if n < 2000:
        return "seribu" + ekor(n - 1000)
    return terbilang(n // 1000) + " ribu" + ekor(n % 1000)


def harga_baru(dasar: int, rng: random.Random) -> int:
    langkah = 500 if dasar < 10000 else 1000
    return max(langkah, dasar + langkah * rng.choice([-3, -2, -1, 1, 2, 3]))


def tulis_harga(h: int, rng: random.Random) -> str:
    """Satu angka harga ditulis dengan gaya yang berbeda-beda."""
    titik = f"{h:,}".replace(",", ".")
    bentuk = [str(h), titik, f"Rp{titik}", f"Rp {titik}", f"rp{titik}", terbilang(h)]
    ribu, sisa = divmod(h, 1000)
    if sisa == 0:
        bentuk += [f"{ribu}rb", f"{ribu}rb", f"{ribu} ribu", f"{ribu}k"]
    elif sisa == 500:
        bentuk += [f"{ribu},5rb", f"{ribu}.5rb"]
    return rng.choice(bentuk)


def isi_template(tpl: str, produk_list, rng: random.Random):
    slot = set(SLOT_RE.findall(tpl))
    nilai, ent = {}, {"produk": "", "harga": "", "periode": "", "cabang": ""}
    nama, dasar = rng.choice(produk_list)
    if "produk" in slot:
        nilai["produk"] = ent["produk"] = nama
    if "harga" in slot:
        h = harga_baru(dasar, rng)
        nilai["harga"], ent["harga"] = tulis_harga(h, rng), str(h)
    for nama_slot, kamus in (("periode", PERIODE), ("periode_depan", PERIODE_DEPAN)):
        if nama_slot in slot:
            kunci = rng.choice(list(kamus))
            nilai[nama_slot], ent["periode"] = rng.choice(kamus[kunci]), kunci
    if "cabang" in slot:
        kunci = rng.choice(list(CABANG))
        nilai["cabang"], ent["cabang"] = rng.choice(CABANG[kunci]), kunci
    teks = tpl.format(**nilai)
    # Kata milik nama produk dan harga tidak boleh kena singkatan/typo
    lindung = set(nilai.get("produk", "").lower().split()) | set(nilai.get("harga", "").lower().split())
    return teks[0].upper() + teks[1:], ent, lindung


# ---------- Augmentasi (kata milik nama produk tidak pernah diubah) ----------

def aug_partikel(t, rng, _lindung):
    if rng.random() < 0.5:
        return rng.choice(["bot, ", "halo bot, ", "eh bot, "]) + t[0].lower() + t[1:]
    inti = t.rstrip("?.! ")
    return inti + rng.choice([" dong", " ya", " nih"]) + t[len(inti):]


def aug_singkatan(t, rng, lindung):
    hasil = []
    for tok in t.split(" "):
        depan, inti, belakang = TOKEN_RE.match(tok).groups()
        kunci = inti.lower()
        if kunci in SINGKATAN and kunci not in lindung and rng.random() < 0.7:
            ganti = rng.choice(SINGKATAN[kunci])
            inti = ganti.capitalize() if inti[:1].isupper() else ganti
        hasil.append(depan + inti + belakang)
    return " ".join(hasil)


def aug_huruf_kecil(t, _rng, _lindung):
    return t.lower()


def aug_tanda_baca(t, _rng, _lindung):
    t = re.sub(r"[?!]+", "", t)
    return re.sub(r"(?<!\d)[.,:](?!\d)", "", t).strip()  # titik/koma di dalam angka dibiarkan


def aug_typo(t, rng, lindung):
    tok = t.split(" ")
    calon = [i for i, w in enumerate(tok) if w.isalpha() and len(w) >= 4 and w.lower() not in lindung]
    if not calon:
        return t
    i = rng.choice(calon)
    w, j = tok[i], rng.randrange(1, len(tok[i]) - 1)
    op = rng.choice(["tukar", "hapus", "ganda"])
    if op == "tukar":
        w = w[:j] + w[j + 1] + w[j] + w[j + 2:]
    elif op == "hapus":
        w = w[:j] + w[j + 1:]
    else:
        w = w[:j] + w[j] + w[j:]
    tok[i] = w
    return " ".join(tok)


AUGMENTASI = [  # (fungsi, peluang dipakai) -- urutan penting
    (aug_partikel, 0.35), (aug_singkatan, 0.6), (aug_huruf_kecil, 0.7),
    (aug_tanda_baca, 0.5), (aug_typo, 0.3),
]


def augmentasi(t, rng, lindung):
    for _ in range(5):  # ulangi sampai kalimat benar-benar berubah
        baru = t
        for fungsi, peluang in AUGMENTASI:
            if rng.random() < peluang:
                baru = fungsi(baru, rng, lindung)
        if normalisasi(baru) != normalisasi(t):
            return baru
    return baru


def normalisasi(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", t.lower())).strip()


# ---------- Bangun dataset ----------

def bangun(produk_list, target, seed):
    rng = random.Random(seed)
    baris, sudah_ada = [], set()
    for intent, daftar in TEMPLATES.items():
        grup = [(f"{intent}-{i + 1:02d}", tpl) for i, tpl in enumerate(daftar)]
        per_grup, jumlah, percobaan = Counter(), 0, 0
        while jumlah < target and percobaan < target * 30:
            for gid, tpl in grup:  # bergiliran supaya tiap grup kebagian rata
                if jumlah >= target:
                    break
                percobaan += 1
                punya_slot = bool(SLOT_RE.search(tpl))
                teks, ent, lindung = isi_template(tpl, produk_list, rng)
                if per_grup[gid] == 0:
                    sumber = "template" if punya_slot else "manual"
                elif punya_slot and rng.random() < 0.4:
                    sumber = "template"  # cukup isi ulang slot dengan nilai lain
                else:
                    sumber = "augmentasi"
                    teks = augmentasi(teks, rng, lindung)
                kunci = normalisasi(teks)
                if kunci in sudah_ada:
                    continue
                sudah_ada.add(kunci)
                baris.append({"text": teks, "intent": intent, **ent, "group_id": gid, "sumber": sumber})
                per_grup[gid] += 1
                jumlah += 1

    # Split per group_id, bertingkat per intent
    grup_test = set()
    for intent in TEMPLATES:
        gids = sorted({b["group_id"] for b in baris if b["intent"] == intent})
        rng.shuffle(gids)
        grup_test.update(gids[:max(1, round(len(gids) * TEST_RATIO))])
    for i, b in enumerate(baris, 1):
        b["id"] = f"INT-{i:04d}"
        b["split"] = "test" if b["group_id"] in grup_test else "train"
    return baris


def periksa(baris):
    """Validasi sebelum diserahkan ke tim AE."""
    for b in baris:
        if b["produk"]:
            assert b["produk"].lower() in b["text"].lower(), f"produk hilang dari teks: {b}"
    split_per_grup = defaultdict(set)
    for b in baris:
        split_per_grup[b["group_id"]].add(b["split"])
    bocor = [g for g, s in split_per_grup.items() if len(s) > 1]
    assert not bocor, f"group_id ada di train dan test: {bocor}"
    assert len({normalisasi(b['text']) for b in baris}) == len(baris), "masih ada duplikat"


def baca_produk(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        hasil = [(r["nama"].strip().lower(), int(re.sub(r"\D", "", r["harga"])))
                 for r in csv.DictReader(f) if r.get("nama") and r.get("harga")]
    if not hasil:
        raise SystemExit(f"Tidak ada baris valid (kolom nama, harga) di {path}")
    return hasil


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--produk", help="CSV daftar produk (kolom: nama, harga)")
    ap.add_argument("--target", type=int, default=130, help="jumlah kalimat per intent")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(HERE / "intent_dataset.csv"))
    args = ap.parse_args()

    produk_list = baca_produk(args.produk) if args.produk else PRODUK_CONTOH
    baris = bangun(produk_list, args.target, args.seed)
    periksa(baris)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=KOLOM)
        w.writeheader()
        w.writerows(baris)

    hitung = Counter((b["intent"], b["split"]) for b in baris)
    grup = defaultdict(set)
    for b in baris:
        grup[(b["intent"], b["split"])].add(b["group_id"])
    print(f"{'intent':<18}{'train':>7}{'test':>6}{'total':>7}   grup train/test")
    for intent in TEMPLATES:
        tr, te = hitung[(intent, "train")], hitung[(intent, "test")]
        print(f"{intent:<18}{tr:>7}{te:>6}{tr + te:>7}   {len(grup[(intent, 'train')])}/{len(grup[(intent, 'test')])}")
    print(f"{'TOTAL':<18}{sum(v for (_, s), v in hitung.items() if s == 'train'):>7}"
          f"{sum(v for (_, s), v in hitung.items() if s == 'test'):>6}{len(baris):>7}")
    print("sumber:", dict(Counter(b["sumber"] for b in baris)))
    print("entitas terisi:", {k: sum(1 for b in baris if b[k]) for k in ("produk", "harga", "periode", "cabang")})
    print(f"Tersimpan: {args.out}")


if __name__ == "__main__":
    main()
