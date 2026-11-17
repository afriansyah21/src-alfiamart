import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { rupiah } from '../format.js';
import { getStoredBanners } from '../banners.js';
import { Search, Package, AlertCircle, ChevronLeft, ChevronRight, Tag, ShoppingBag, Sparkles } from 'lucide-react';

const LIMIT = 24;

function initials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function Katalog() {
  const [banners, setBanners] = useState(getStoredBanners);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State untuk Carousel Iklan
  const [activeBanner, setActiveBanner] = useState(0);

  // Dengarkan perubahan banner dari menu Kelola Katalog Owner
  useEffect(() => {
    const handleUpdate = () => setBanners(getStoredBanners());
    window.addEventListener('banners:updated', handleUpdate);
    return () => window.removeEventListener('banners:updated', handleUpdate);
  }, []);

  // Auto-play Carousel tiap 4.5 detik
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    api.get('/catalog/categories')
      .then((r) => setCategories(r.data.data.map((c) => c.category)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setError('');
    api.get('/catalog', { params: { q: debounced || undefined, category: category || undefined, page, limit: LIMIT } })
      .then((r) => setData({ rows: r.data.data, total: r.data.meta.total }))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [debounced, category, page]);

  const pages = Math.max(1, Math.ceil(data.total / LIMIT));

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Bilah Atas Merah & Pencarian ── */}
      <header className="top-bar">
        <div className="mx-auto max-w-6xl px-4 pb-3.5 pt-3">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white">
              <img src="/putih.png" alt="Logo SRC Alfiamart" className="h-8 w-auto max-w-[110px] object-contain -translate-y-0.5" />
              <span className="text-base font-extrabold tracking-tight leading-none">SRC Alfiamart</span>
            </div>
          </div>

          {/* Kolom Cari Putih Bersih */}
          <label htmlFor="q-katalog" className="sr-only">Cari produk</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              id="q-katalog"
              type="search"
              className="h-11 w-full rounded-xl border-0 bg-white !pl-11 pr-4 text-sm text-[#0F172A] shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-white/80"
              placeholder="Cari produk kebutuhan Anda di sini..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* ── Konten Utama ── */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">

        {/* ── CAROUSEL IKLAN PROMO (5 Slide Mirip Contoh) ── */}
        <section aria-label="Iklan dan Promo" className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-xs">
            {/* Slide Container */}
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activeBanner * 100}%)` }}
            >
              {banners.map((b) => (
                <div
                  key={b.id}
                  className={`w-full shrink-0 h-44 sm:h-56 md:h-64 bg-gradient-to-r ${b.bg} relative p-6 sm:p-8 flex items-center text-white overflow-hidden`}
                >
                  {/* Background Ilustrasi Abstrak Toko */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 pointer-events-none flex items-center justify-center">
                    <Sparkles size={180} />
                  </div>

                  {/* Jika ada gambar iklan PNG/JPG sungguhan */}
                  {b.imgUrl ? (
                    <img src={b.imgUrl} alt={b.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    /* Tampilan Placeholder Iklan Elegan */
                    <div className="relative z-10 max-w-lg space-y-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#3A2A00]"
                        style={{ backgroundColor: b.accent }}
                      >
                        <Sparkles size={13} />
                        {b.tag}
                      </span>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                        {b.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-white/85 font-medium leading-relaxed">
                        {b.subtitle}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Tombol Navigasi Panah Kiri/Kanan */}
            <button
              type="button"
              onClick={() => setActiveBanner((prev) => (prev === 0 ? banners.length - 1 : prev - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-all cursor-pointer shadow-sm"
              aria-label="Slide sebelumnya"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setActiveBanner((prev) => (prev + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white transition-all cursor-pointer shadow-sm"
              aria-label="Slide berikutnya"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Indikator Titik (Dots Slider ala Minimarket) */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveBanner(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  activeBanner === idx
                    ? 'w-6 bg-[#0284C7]'
                    : 'w-2 bg-[#CBD5E1] hover:bg-[#94A3B8]'
                }`}
                aria-label={`Pilih slide ${idx + 1}`}
              />
            ))}
          </div>
        </section>

        {/* ── KATEGORI BELANJA (Mirip Gambar Acuan) ── */}
        <section aria-label="Kategori Belanja" className="space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E0F2FE] text-[#0284C7]">
              <ShoppingBag size={14} />
            </div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Kategori Belanja</h2>
          </div>

          {/* Grid/Scroll Card Kategori Mirip Alfagift */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            <button
              type="button"
              onClick={() => { setCategory(''); setPage(1); }}
              className={`flex items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer min-h-[52px] ${
                category === ''
                  ? 'border-[#D6212A] bg-[#FEF2F2] shadow-xs'
                  : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              <span className={`text-xs font-bold leading-tight ${category === '' ? 'text-[#D6212A]' : 'text-[#334155]'}`}>
                Semua
              </span>
            </button>

            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCategory(c); setPage(1); }}
                className={`flex items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer min-h-[52px] ${
                  category === c
                    ? 'border-[#D6212A] bg-[#FEF2F2] shadow-xs'
                    : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                }`}
              >
                <span className={`text-xs font-bold leading-tight line-clamp-2 ${category === c ? 'text-[#D6212A]' : 'text-[#334155]'}`}>
                  {c}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── DAFTAR PRODUK SESUAI KATEGORI ── */}
        <section aria-label="Daftar Produk" className="space-y-4 pt-2">
          {!loading && !error && data.total > 0 && (
            <div className="flex items-center justify-between text-xs text-[#64748B] border-b border-[#E2E8F0] pb-2">
              <span>
                Menampilkan <strong className="text-[#0F172A]">{data.total}</strong> produk
                {category && <span> dalam kategori <strong className="text-[#0F172A]">{category}</strong></span>}
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#DC2626]" />
              <span>{error}</span>
            </div>
          )}

          {loading && data.rows.length === 0 && (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="product-card animate-pulse">
                  <div className="img-placeholder bg-[#E2E8F0]" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3.5 w-4/5 rounded bg-[#E2E8F0]" />
                    <div className="h-3 w-1/2 rounded bg-[#E2E8F0]" />
                    <div className="h-5 w-2/3 rounded bg-[#E2E8F0] mt-3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && data.rows.length === 0 && !error && (
            <div className="flex flex-col items-center py-16 text-center">
              <Package size={52} className="mb-3 text-[#CBD5E1]" />
              <p className="font-bold text-base text-[#0F172A]">Produk Tidak Ditemukan</p>
              <p className="mt-1 text-xs text-[#64748B]">Coba periksa ejaan atau pilih kategori lainnya.</p>
            </div>
          )}

          {data.rows.length > 0 && (
            <div
              className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              aria-busy={loading}
            >
              {data.rows.map((p) => (
                <article key={p.id} className="product-card">
                  {/* Gambar Placeholder Bersih */}
                  <div className="img-placeholder bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] border-b border-[#E2E8F0]">
                    <span className="font-bold text-xl tracking-wider text-[#94A3B8]">
                      {initials(p.name)}
                    </span>
                    <div className="absolute bottom-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B] border border-[#E2E8F0]">
                      {p.category}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-3.5">
                    <p className="line-clamp-2 text-sm font-semibold text-[#1E293B] leading-snug">
                      {p.name}
                    </p>
                    <span className="mt-0.5 text-xs text-[#94A3B8]">
                      per {p.unit}
                    </span>

                    <div className="mt-auto pt-3 border-t border-[#F1F5F9]">
                      <span className="text-base font-bold font-mono text-[#D6212A]">
                        {rupiah(p.price)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Paginasi */}
          {data.total > LIMIT && (
            <div className="mt-8 flex items-center justify-between border-t border-[#E2E8F0] pt-4">
              <p className="text-xs text-[#64748B]">
                Halaman {page} dari {pages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={15} />
                  <span>Sebelumnya</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span>Berikutnya</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
