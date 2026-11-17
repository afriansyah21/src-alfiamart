import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { rupiah } from '../format.js';
import { getStoredBanners, saveStoredBanners } from '../banners.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import {
  Search, Package, AlertCircle, ChevronLeft, ChevronRight, Tag,
  ShoppingBag, Sparkles, Image as ImageIcon, Edit3, Eye, Check, RefreshCw
} from 'lucide-react';

const LIMIT = 24;

function initials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function KelolaKatalog() {
  const toast = useToast();
  const [banners, setBanners] = useState(getStoredBanners);
  const [activeBanner, setActiveBanner] = useState(0);

  // Modal edit banner
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState({ title: '', subtitle: '', tag: '', imgUrl: '' });

  // Data katalog produk
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auto-play Carousel
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

  const openEditBanner = (b) => {
    setEditingBanner(b);
    setBannerForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      tag: b.tag || '',
      imgUrl: b.imgUrl || ''
    });
  };

  const handleSaveBanner = (e) => {
    e.preventDefault();
    if (!editingBanner) return;

    const updated = banners.map((b) => (b.id === editingBanner.id ? { ...b, ...bannerForm } : b));
    setBanners(updated);
    saveStoredBanners(updated);
    toast.success(`Banner #${editingBanner.id} berhasil diperbarui`);
    setEditingBanner(null);
  };

  // Upload file gambar lokal langsung ke Base64 (tanpa perlu backend)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG, JPG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBannerForm((prev) => ({ ...prev, imgUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const pages = Math.max(1, Math.ceil(data.total / LIMIT));

  return (
    <div className="space-y-6">
      {/* ── Banner Info Khusus Owner ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Kelola &amp; Pratinjau Katalog</h1>
            <span className="inline-flex items-center rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#B45309] border border-[#FDE68A]">
              Owner Mode
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
            Halaman ini menampilkan persis apa yang dilihat pelanggan di Katalog Publik. Anda dapat mengatur foto/teks 5 carousel iklan promo di bawah ini.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">
            {banners.filter(b => Boolean(b.imgUrl)).length} dari 5 banner bergambar
          </span>
        </div>
      </div>

      {/* ── CAROUSEL IKLAN PROMO DENGAN KONTROL EDIT ── */}
      <section aria-label="Iklan dan Promo" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#D6212A]" />
            <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
              Carousel Iklan Promo (5 Slide)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openEditBanner(banners[activeBanner])}
            className="btn btn-secondary btn-sm"
          >
            <Edit3 size={14} />
            <span>Ubah Banner Aktif (#{banners[activeBanner].id})</span>
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-xs">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeBanner * 100}%)` }}
          >
            {banners.map((b) => (
              <div
                key={b.id}
                className={`w-full shrink-0 h-44 sm:h-60 md:h-72 bg-gradient-to-r ${b.bg} relative p-6 sm:p-8 flex items-center text-white overflow-hidden`}
              >
                {/* Background Ilustrasi */}
                <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 pointer-events-none flex items-center justify-center">
                  <Sparkles size={180} />
                </div>

                {b.imgUrl ? (
                  <img src={b.imgUrl} alt={b.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
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

                {/* Tombol edit langsung di atas banner */}
                <button
                  type="button"
                  onClick={() => openEditBanner(b)}
                  className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-xl bg-black/60 hover:bg-black/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-xs transition-all cursor-pointer shadow-md"
                >
                  <Edit3 size={14} />
                  <span>Ganti Gambar / Teks</span>
                </button>
              </div>
            ))}
          </div>

          {/* Panah Carousel */}
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

        {/* Dots Slider */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {banners.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBanner(idx)}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                activeBanner === idx
                  ? 'w-7 bg-[#0284C7]'
                  : 'w-2.5 bg-[#CBD5E1] hover:bg-[#94A3B8]'
              }`}
              title={`Slide #${b.id}`}
            />
          ))}
        </div>
      </section>

      {/* ── KATEGORI BELANJA ── */}
      <section aria-label="Kategori Belanja" className="space-y-3.5 pt-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E0F2FE] text-[#0284C7]">
            <ShoppingBag size={14} />
          </div>
          <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Kategori Belanja</h2>
        </div>

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div className="text-xs text-[#64748B]">
            Menampilkan <strong className="text-[#0F172A]">{data.total}</strong> produk aktif
            {category && <span> dalam kategori <strong className="text-[#0F172A]">{category}</strong></span>}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              className="field !pl-9 h-9 text-xs placeholder:text-[#94A3B8]"
              placeholder="Cari nama produk..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

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
            <p className="mt-1 text-xs text-[#64748B]">Coba periksa kata kunci atau pilih kategori lainnya.</p>
          </div>
        )}

        {data.rows.length > 0 && (
          <div
            className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            aria-busy={loading}
          >
            {data.rows.map((p) => (
              <article key={p.id} className="product-card">
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

      {/* ── MODAL EDIT BANNER CAROUSEL ── */}
      {editingBanner && (
        <Modal title={`Ubah Banner Iklan #${editingBanner.id}`} onClose={() => setEditingBanner(null)}>
          <form onSubmit={handleSaveBanner} className="space-y-4">
            {/* Input Gambar (File Langsung atau URL) */}
            <div>
              <label className="label">Gambar Banner</label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="field text-xs file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#F1F5F9] file:text-[#0F172A]"
                />
                <div className="relative">
                  <input
                    type="text"
                    className="field text-xs"
                    placeholder="Atau tempel URL gambar (misal: /images/promo.png)"
                    value={bannerForm.imgUrl.startsWith('data:') ? '(Gambar Lokal Terpilih)' : bannerForm.imgUrl}
                    onChange={(e) => setBannerForm((prev) => ({ ...prev, imgUrl: e.target.value }))}
                  />
                  {bannerForm.imgUrl && (
                    <button
                      type="button"
                      onClick={() => setBannerForm((prev) => ({ ...prev, imgUrl: '' }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#DC2626] font-semibold cursor-pointer"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Pratinjau Gambar jika ada */}
            {bannerForm.imgUrl && (
              <div className="rounded-xl border border-[#E2E8F0] overflow-hidden h-28 bg-[#F1F5F9] relative">
                <img src={bannerForm.imgUrl} alt="Pratinjau" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  Pratinjau Gambar
                </span>
              </div>
            )}

            {/* Teks Banner */}
            <div>
              <label htmlFor="b-tag" className="label">Tag / Kategori Iklan</label>
              <input
                id="b-tag"
                type="text"
                className="field text-sm"
                value={bannerForm.tag}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, tag: e.target.value }))}
                placeholder="misal: Harga Spesial / Promo Gajian"
              />
            </div>

            <div>
              <label htmlFor="b-title" className="label">Judul Banner</label>
              <input
                id="b-title"
                type="text"
                className="field text-sm"
                value={bannerForm.title}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="misal: Hemat Sembako Mingguan"
                required
              />
            </div>

            <div>
              <label htmlFor="b-sub" className="label">Keterangan / Subjudul</label>
              <input
                id="b-sub"
                type="text"
                className="field text-sm"
                value={bannerForm.subtitle}
                onChange={(e) => setBannerForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="misal: Diskon s/d 30% untuk beras dan minyak"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingBanner(null)}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Simpan Perubahan Banner
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
