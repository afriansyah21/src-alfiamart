import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import { rupiah } from '../format.js';
import { useAuth } from '../auth.jsx';
import { Search, Store, Package, AlertCircle, ChevronLeft, ChevronRight, Tag } from 'lucide-react';

const LIMIT = 24;

function initials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function Katalog() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      {/* ── Bilah Atas Merah & Aksen Garis Emas ── */}
      <header className="top-bar">
        <div className="mx-auto max-w-6xl px-4 pb-3.5 pt-3">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#D6212A]">
                <Store size={19} className="stroke-[2.5]" />
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight">SRC Alfiamart</span>
                <span className="ml-2 inline-flex rounded bg-[#FFC72C] px-1.5 py-0.2 text-[10px] font-black uppercase text-[#3A2A00]">
                  Katalog
                </span>
              </div>
            </div>
            <Link
              to={user ? (user.role === 'owner' ? '/produk' : '/kasir') : '/login'}
              className="rounded-lg border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-all"
            >
              {user ? 'Kembali ke Aplikasi' : 'Masuk Staf'}
            </Link>
          </div>

          {/* Kolom Cari Putih Bersih */}
          <label htmlFor="q-katalog" className="sr-only">Cari produk</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              id="q-katalog"
              type="search"
              className="h-11 w-full rounded-xl border-0 bg-white pl-10 pr-4 text-sm text-[#0F172A] shadow-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-white/80"
              placeholder="Cari produk kebutuhan Anda di sini..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Chip Kategori Geser Horizontal */}
        <div className="overflow-x-auto scrollbar-none border-t border-white/10 bg-[#C71923]">
          <div className="mx-auto max-w-6xl flex gap-2 px-4 py-2.5">
            <button
              type="button"
              className={`chip ${category === '' ? 'chip-active' : ''}`}
              onClick={() => { setCategory(''); setPage(1); }}
            >
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${category === c ? 'chip-active' : ''}`}
                onClick={() => { setCategory(c); setPage(1); }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Konten Grid Produk ── */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {!loading && !error && data.total > 0 && (
          <div className="mb-4 flex items-center justify-between text-xs text-[#64748B]">
            <span>
              Menampilkan <strong className="text-[#0F172A]">{data.total}</strong> produk aktif
              {category && <span> dalam kategori <strong className="text-[#0F172A]">{category}</strong></span>}
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
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
          <div className="flex flex-col items-center py-20 text-center">
            <Package size={52} className="mb-3 text-[#CBD5E1]" />
            <p className="font-bold text-base text-[#0F172A]">Produk Tidak Ditemukan</p>
            <p className="mt-1 text-xs text-[#64748B]">Coba periksa ejaan atau gunakan filter kategori lainnya.</p>
          </div>
        )}

        {data.rows.length > 0 && (
          <div
            className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            aria-busy={loading}
          >
            {data.rows.map((p) => (
              <article key={p.id} className="product-card">
                {/* Gambar Placeholder Bersih & Modern */}
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
                    {/* Harga Bersih Elegan Tanpa Blok Kuning Norak */}
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
      </main>
    </div>
  );
}
