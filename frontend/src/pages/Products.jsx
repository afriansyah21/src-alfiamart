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
  Package, ChevronLeft, ChevronRight, Tag, Boxes, ArrowUpDown, Filter, Trash2
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

  const deleteProduct = async (product) => {
    try {
      await api.delete(`/products/${product.id}`);
      toast.success(`Produk ${product.name} berhasil dihapus`);
      // Update state data lokal langsung agar baris langsung hilang
      setData((prev) => ({
        ...prev,
        rows: prev.rows.filter((r) => r.id !== product.id),
        meta: { ...prev.meta, total: Math.max(0, (prev.meta?.total || 1) - 1) }
      }));
      close();
      refresh();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  // Statistik ringkas untuk Owner
  const activeCount = data.rows.filter(r => r.is_active).length;

  return (
    <div className="space-y-6">
      {/* ── Header Halaman & Quick Actions ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Katalog Produk &amp; Harga</h1>
            <span className="inline-flex items-center rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-semibold text-[#B45309] border border-[#FDE68A]">
              Owner Portal
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748B]">
            Kelola master SKU, pengaturan harga serentak untuk kasir dan katalog pelanggan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="btn btn-secondary text-sm font-semibold"
            onClick={() => setDialog({ type: 'import' })}
          >
            <Upload size={16} className="text-[#64748B]" />
            <span>Impor CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm font-semibold"
            onClick={() => setDialog({ type: 'form' })}
          >
            <Plus size={17} />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* ── Filter & Search Bar Card ── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <label htmlFor="search" className="sr-only">Cari produk</label>
            <input
              id="search"
              type="search"
              className="field !pl-11 h-11 text-sm placeholder:text-[#94A3B8]"
              placeholder="Cari berdasarkan nama produk atau SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <label htmlFor="cat" className="sr-only">Filter kategori</label>
            <select
              id="cat"
              className="field !pl-10 h-11 text-sm font-medium text-[#334155]"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-[#DC2626] shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Coba Lagi</button>
        </div>
      )}

      {/* ── Tabel & List Produk ── */}
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        {loading && data.rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#D6212A] border-t-transparent" />
            <p className="mt-2 text-sm text-[#64748B]">Memuat daftar produk...</p>
          </div>
        ) : data.rows.length === 0 && !error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8] mb-3">
              <Package size={26} />
            </div>
            <p className="font-semibold text-[#0F172A]">
              {debouncedQ || category ? 'Tidak ada produk yang cocok' : 'Belum ada data produk'}
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              {debouncedQ || category
                ? 'Silakan gunakan kata kunci atau kategori yang berbeda.'
                : 'Mulai dengan menambahkan produk baru atau lakukan impor dari file CSV.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-busy={loading}>
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Produk</th>
                  <th scope="col" className="px-4 py-3.5">Kategori &amp; Satuan</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Harga Toko</th>
                  <th scope="col" className="px-3 py-3.5 text-center">Stok Alfiamart 1</th>
                  <th scope="col" className="px-3 py-3.5 text-center">Stok Alfiamart 2</th>
                  <th scope="col" className="px-3 py-3.5 text-center">Stok Total</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {data.rows.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-[#F8FAFC]/80 ${!p.is_active ? 'bg-[#F8FAFC]/50 opacity-75' : ''}`}
                  >
                    {/* Nama & SKU */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#475569]">
                          {p.sku.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold ${p.is_active ? 'text-[#0F172A]' : 'text-[#64748B] line-through'}`}>
                            {p.name}
                          </p>
                          <span className="font-mono text-xs text-[#94A3B8]">
                            SKU: {p.sku}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kategori & Satuan */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#334155]">{p.category}</span>
                        <span className="text-xs text-[#64748B]">per {p.unit}</span>
                      </div>
                    </td>

                    {/* Harga (Bersih tanpa blok kuning) */}
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span className="text-base font-bold font-mono text-[#D6212A]">
                          {rupiah(p.price)}
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">termasuk PPN</span>
                      </div>
                    </td>

                    {/* Stok Alfiamart 1 */}
                    <td className="px-3 py-4 text-center whitespace-nowrap">
                      {(p.stock_alfiamart1 ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold font-mono text-[#334155] border border-[#E2E8F0]">
                          {p.stock_alfiamart1} {p.unit}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-xs font-semibold text-[#DC2626] border border-[#FECACA]">
                          0
                        </span>
                      )}
                    </td>

                    {/* Stok Alfiamart 2 */}
                    <td className="px-3 py-4 text-center whitespace-nowrap">
                      {(p.stock_alfiamart2 ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold font-mono text-[#334155] border border-[#E2E8F0]">
                          {p.stock_alfiamart2} {p.unit}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-xs font-semibold text-[#DC2626] border border-[#FECACA]">
                          0
                        </span>
                      )}
                    </td>

                    {/* Stok Total */}
                    <td className="px-3 py-4 text-center whitespace-nowrap">
                      {(p.stock ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2.5 py-1 text-xs font-bold font-mono text-[#1D4ED8] border border-[#BFDBFE]">
                          {p.stock} {p.unit}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2.5 py-1 text-xs font-bold text-[#DC2626] border border-[#FECACA]">
                          Habis (0)
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#047857] border border-[#A7F3D0]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B] border border-[#E2E8F0]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]" />
                          Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-icon"
                          title="Ubah Produk"
                          onClick={() => setDialog({ type: 'form', product: p })}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Riwayat Perubahan Harga"
                          onClick={() => setDialog({ type: 'history', product: p })}
                        >
                          <History size={15} />
                        </button>
                        {p.is_active ? (
                          <button
                            type="button"
                            className="btn-icon text-[#B45309] hover:bg-[#FFFBEB] hover:border-[#FDE68A]"
                            title="Nonaktifkan Produk"
                            onClick={() => setDialog({ type: 'deactivate', product: p })}
                          >
                            <PowerOff size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-icon text-[#047857] hover:bg-[#ECFDF5] hover:border-[#A7F3D0]"
                            title="Aktifkan Kembali"
                            onClick={() => setActive(p, true)}
                          >
                            <PowerIcon size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-icon text-[#DC2626] hover:bg-[#FEF2F2] hover:border-[#FECACA]"
                          title="Hapus Produk"
                          onClick={() => setDialog({ type: 'delete', product: p })}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginasi ── */}
      {data.meta.total > LIMIT && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
          <p className="text-xs text-[#64748B]">
            Menampilkan <strong className="text-[#0F172A]">{data.rows.length}</strong> dari{' '}
            <strong className="text-[#0F172A]">{data.meta.total}</strong> total produk (Halaman {page} dari {totalPages})
          </p>
          <div className="flex items-center gap-1.5">
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
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <span>Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Dialog Modals ── */}
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
          <div className="space-y-4">
            <p className="text-sm text-[#334155] leading-relaxed">
              Produk <strong className="text-[#0F172A]">{dialog.product.name}</strong> tidak akan lagi muncul di katalog maupun mesin kasir.
              Data riwayat transaksi lama tetap aman dan produk bisa diaktifkan kembali sewaktu-waktu.
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
              <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={() => setActive(dialog.product, false)}>
                <PowerOff size={15} />
                <span>Nonaktifkan</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
      {dialog?.type === 'delete' && (
        <Modal title="Hapus produk?" onClose={close}>
          <div className="space-y-4">
            <p className="text-sm text-[#334155] leading-relaxed">
              Apakah Anda yakin ingin menghapus produk <strong className="text-[#0F172A]">{dialog.product.name}</strong> ({dialog.product.sku})?
              Produk akan dihapus dari daftar katalog aktif dan kasir.
            </p>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
              <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={() => deleteProduct(dialog.product)}>
                <Trash2 size={15} />
                <span>Hapus Produk</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
