import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import { rupiah } from '../format.js';
import { useAuth } from '../auth.jsx';
import { Search, Store, Package, AlertCircle, ChevronLeft, ChevronRight, Tag } from 'lucide-react';

const LIMIT = 24;

/* Inisial 2 huruf dari nama produk untuk placeholder gambar */
function initials(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* Warna placeholder berdasarkan kategori */
const CAT_COLOR = {
  Sembako:    '#FEE9E9',
  Makanan:    '#FFF3DC',
  Minuman:    '#E8F4FD',
  Kebersihan: '#E9F7F0',
  Rokok:      '#F5F0FF',
};
const catColor = (c) => CAT_COLOR[c] || '#F4F4F5';

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
    <div className="min-h-screen bg-[#F4F4F5]">
      {/* ── Bilah atas merah ── */}
      <header className="top-bar">
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-3">
          {/* Baris merek + tombol staf */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Store size={20} />
              <span className="text-base font-bold tracking-tight">SRC Alfiamart</span>
            </div>
            <Link
              to={user ? (user.role === 'owner' ? '/produk' : '/kasir') : '/login'}
              className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              {user ? 'Kembali ke aplikasi' : 'Masuk staf'}
            </Link>
          </div>

          {/* Kolom cari — putih membulat */}
          <label htmlFor="q-katalog" className="sr-only">Cari produk</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6670]" />
            <input
              id="q-katalog"
              type="search"
              className="h-11 w-full rounded-full border-0 bg-white pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-white/60"
              placeholder="Cari nama produk…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Chip kategori — geser horizontal */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-2 px-4 pb-3">
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

      {/* ── Konten ── */}
      <main className="mx-auto max-w-6xl px-4 py-5">
        {/* Info total */}
        {!loading && !error && data.total > 0 && (
          <p className="mb-3 text-sm text-[#5F6670]">
            {data.total} produk{category ? ` · ${category}` : ''}
            {debounced ? ` · "${debounced}"` : ''}
          </p>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-[#F4B8B8] bg-[#FCEAEA] px-4 py-3 text-sm text-[#A01520]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading awal */}
        {loading && data.rows.length === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="product-card animate-pulse">
                <div className="img-placeholder" style={{ background: '#E9EAEC' }} />
                <div className="p-3">
                  <div className="mb-1 h-3 w-3/4 rounded bg-[#E3E5E8]" />
                  <div className="h-3 w-1/2 rounded bg-[#E3E5E8]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Kosong */}
        {!loading && data.rows.length === 0 && !error && (
          <div className="flex flex-col items-center py-16 text-center">
            <Package size={48} className="mb-3 text-[#E3E5E8]" />
            <p className="font-semibold text-[#1F2328]">Tidak ada produk yang cocok</p>
            <p className="mt-1 text-sm text-[#5F6670]">Coba kata kunci atau kategori lain</p>
          </div>
        )}

        {/* Grid produk — 2 kolom ponsel, 3-5 kolom desktop */}
        {data.rows.length > 0 && (
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            aria-busy={loading}
          >
            {data.rows.map((p) => (
              <li key={p.id}>
                <article className="product-card">
                  {/* Placeholder gambar */}
                  <div
                    className="img-placeholder"
                    style={{ background: catColor(p.category) }}
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Tag size={20} style={{ color: '#5F6670' }} />
                      <span className="text-[10px] font-bold tracking-widest text-[#5F6670]">
                        {initials(p.name)}
                      </span>
                    </div>
                  </div>

                  {/* Info produk */}
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                    <p className="mb-2 mt-0.5 text-[11px] text-[#5F6670]">per {p.unit}</p>
                    <div className="mt-auto">
                      <span className="price-tag text-base">{rupiah(p.price)}</span>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        {/* Paginasi */}
        {data.total > LIMIT && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-[#5F6670]">
              Halaman {page} dari {pages} · {data.total} produk
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={16} />
                Sebelumnya
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Halaman berikutnya"
              >
                Berikutnya
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
