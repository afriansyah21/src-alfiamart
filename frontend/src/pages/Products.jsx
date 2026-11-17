import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { rupiah } from '../format.js';
import ProductForm from '../components/ProductForm.jsx';
import ImportDialog from '../components/ImportDialog.jsx';
import PriceHistory from '../components/PriceHistory.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import {
  Search, Upload, Plus, Pencil, History, PowerOff, PowerIcon, AlertCircle,
  Package, ChevronLeft, ChevronRight,
} from 'lucide-react';

const LIMIT = 20;

export default function Products() {
  const toast = useToast();
  const [q, setQ]                     = useState('');
  const [debouncedQ, setDebouncedQ]   = useState('');
  const [category, setCategory]       = useState('');
  const [page, setPage]               = useState(1);
  const [data, setData]               = useState({ rows: [], meta: { total: 0 } });
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [dialog, setDialog]           = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/products', { params: { q: debouncedQ || undefined, category: category || undefined, page, limit: LIMIT } });
      setData({ rows: res.data.data, meta: res.data.meta });
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [debouncedQ, category, page]);

  useEffect(() => { load(); }, [load]);

  const loadCategories = useCallback(() => {
    api.get('/catalog/categories').then((res) => setCategories(res.data.data.map((c) => c.category))).catch(() => {});
  }, []);
  useEffect(loadCategories, [loadCategories]);

  const refresh = () => { load(); loadCategories(); };
  const close   = () => setDialog(null);
  const totalPages = Math.max(1, Math.ceil(data.meta.total / LIMIT));

  const setActive = async (product, active) => {
    try {
      await api.patch(`/products/${product.id}`, { is_active: active });
      toast.success(active ? `${product.name} diaktifkan kembali` : `${product.name} dinonaktifkan`);
      close(); refresh();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div>
      {/* ── Judul + aksi ── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Produk &amp; Harga</h1>
          <p className="text-sm text-[#5F6670]">Ubah harga di sini — langsung berlaku di kasir dan katalog.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDialog({ type: 'import' })}
          >
            <Upload size={16} />
            Impor CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setDialog({ type: 'form' })}
          >
            <Plus size={16} />
            Tambah produk
          </button>
        </div>
      </div>

      {/* ── Filter cari + kategori ── */}
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6670]" />
          <label htmlFor="search" className="sr-only">Cari produk</label>
          <input
            id="search"
            type="search"
            className="field pl-9"
            placeholder="Cari nama atau SKU"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cat" className="sr-only">Filter kategori</label>
          <select
            id="cat"
            className="field"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[#F4B8B8] bg-[#FCEAEA] px-4 py-3 text-sm text-[#A01520]"
        >
          <span className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </span>
          <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={load}>Coba lagi</button>
        </div>
      )}

      {/* ── Tabel produk ── */}
      <div className="overflow-hidden rounded-xl border border-[#E3E5E8] bg-white">
        {loading && data.rows.length === 0 ? (
          <p className="p-6 text-sm text-[#5F6670]">Memuat produk…</p>
        ) : data.rows.length === 0 && !error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Package size={48} className="mb-3 text-[#E3E5E8]" />
            <p className="font-semibold">
              {debouncedQ || category ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.'}
            </p>
            <p className="mt-1 text-sm text-[#5F6670]">
              {debouncedQ || category
                ? 'Coba kata kunci atau kategori lain.'
                : 'Tambahkan satu per satu atau impor dari CSV.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E3E5E8]" aria-busy={loading}>
            {data.rows.map((p) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${!p.is_active ? 'bg-[#F4F4F5]' : ''}`}
              >
                {/* Info produk */}
                <div className="min-w-0 flex-1 basis-48">
                  <p className={`truncate font-semibold ${!p.is_active ? 'text-[#5F6670]' : ''}`}>{p.name}</p>
                  <p className="text-xs text-[#5F6670]">
                    {p.sku} &middot; {p.category} &middot; per {p.unit}
                    {!p.is_active && (
                      <span className="ml-2 rounded bg-[#E3E5E8] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5F6670]">
                        Nonaktif
                      </span>
                    )}
                  </p>
                </div>

                {/* Harga */}
                <span
                  className="price-tag text-xl sm:min-w-32 sm:text-right"
                  aria-label={`Harga ${rupiah(p.price)}`}
                >
                  {rupiah(p.price)}
                </span>

                {/* Aksi */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDialog({ type: 'form', product: p })}
                  >
                    <Pencil size={14} />
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDialog({ type: 'history', product: p })}
                  >
                    <History size={14} />
                    Riwayat
                  </button>
                  {p.is_active ? (
                    /* Nonaktifkan — dipisah visual (btn-danger) */
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDialog({ type: 'deactivate', product: p })}
                    >
                      <PowerOff size={14} />
                      Nonaktifkan
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActive(p, true)}
                    >
                      <PowerIcon size={14} />
                      Aktifkan
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Paginasi ── */}
      {data.meta.total > LIMIT && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[#5F6670]">
            {data.meta.total} produk &middot; halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={14} /> Sebelumnya
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Dialog ── */}
      {dialog?.type === 'form' && (
        <ProductForm product={dialog.product} categories={categories} onClose={close} onSaved={() => { close(); refresh(); }} />
      )}
      {dialog?.type === 'import' && (
        <ImportDialog onClose={close} onDone={refresh} />
      )}
      {dialog?.type === 'history' && (
        <PriceHistory product={dialog.product} onClose={close} onChanged={refresh} />
      )}
      {dialog?.type === 'deactivate' && (
        <Modal title="Nonaktifkan produk?" onClose={close}>
          <p className="text-sm text-[#1F2328]">
            <strong>{dialog.product.name}</strong> tidak akan tampil di kasir dan katalog.
            Riwayat transaksi tetap tersimpan dan produk bisa diaktifkan kembali kapan saja.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
            <button type="button" className="btn btn-danger" onClick={() => setActive(dialog.product, false)}>
              <PowerOff size={15} /> Nonaktifkan
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
