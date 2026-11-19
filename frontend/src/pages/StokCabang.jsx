import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';
import { rupiah } from '../format.js';
import { useAuth } from '../auth.jsx';
import {
  Search, Package, AlertCircle, RefreshCw, Store, CheckCircle2, AlertTriangle, Layers
} from 'lucide-react';

const LIMIT = 50;

export default function StokCabang() {
  const { user } = useAuth();
  const [q, setQ]                   = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory]     = useState('');
  const [page, setPage]             = useState(1);
  const [data, setData]             = useState({ rows: [], meta: { total: 0 } });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Identifikasi cabang kasir saat ini
  const isCabang1 = user?.username === 'alfiamartsatu';
  const isCabang2 = user?.username === 'alfiamartdua';
  const branchName = isCabang2 ? 'Alfiamart 2' : 'Alfiamart 1';
  const branchStockKey = isCabang2 ? 'stock_alfiamart2' : 'stock_alfiamart1';

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/products', {
        params: {
          q: debouncedQ || undefined,
          category: category || undefined,
          page,
          limit: LIMIT,
        },
      });
      setData({ rows: res.data.data, meta: res.data.meta });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCategories = useCallback(() => {
    api.get('/catalog/categories')
      .then((res) => setCategories(res.data.data.map((c) => c.category)))
      .catch(() => {});
  }, []);

  useEffect(loadCategories, [loadCategories]);

  // Statistik ketersediaan stok cabang
  const totalProducts = data.rows.length;
  const inStockCount = data.rows.filter((p) => (p[branchStockKey] ?? 0) > 0).length;
  const outOfStockCount = data.rows.filter((p) => (p[branchStockKey] ?? 0) <= 0).length;

  return (
    <div className="space-y-6">
      {/* ── Banner Header Info Toko Cabang ── */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-bold text-[#047857] border border-[#A7F3D0]">
                <Store size={13} />
                <span>{branchName} — Adipala, Cilacap</span>
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">Ketersediaan Stok Toko</h1>
            <p className="text-sm text-[#64748B]">
              Monitoring ketersediaan produk dan sisa stok fisik di cabang {branchName}.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary self-start sm:self-auto"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan Stok</span>
          </button>
        </div>

        {/* ── Ringkasan Ketersediaan ── */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                <Layers size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#64748B]">Total Produk Terdaftar</p>
                <p className="text-lg font-black text-[#0F172A]">{data.meta.total || totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D1FAE5] text-[#059669]">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#065F46]">Stok Tersedia ({branchName})</p>
                <p className="text-lg font-black text-[#047857]">{inStockCount} item</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#DC2626]">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#991B1B]">Stok Habis di Cabang</p>
                <p className="text-lg font-black text-[#B91C1C]">{outOfStockCount} item</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar Pencarian & Filter ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            className="field !pl-10 h-10 w-full text-sm placeholder:text-[#94A3B8]"
            placeholder="Cari nama produk atau SKU..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            className="field h-10 text-sm font-medium"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-[#DC2626] shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Coba Lagi</button>
        </div>
      )}

      {/* ── Tabel Ketersediaan Stok ── */}
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        {loading && data.rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#D6212A] border-t-transparent" />
            <p className="mt-2 text-sm text-[#64748B]">Memuat ketersediaan stok...</p>
          </div>
        ) : data.rows.length === 0 && !error ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8] mb-3">
              <Package size={26} />
            </div>
            <p className="font-semibold text-[#0F172A]">Tidak ada produk ditemukan</p>
            <p className="mt-1 text-sm text-[#64748B]">Coba gunakan kata kunci pencarian yang berbeda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-busy={loading}>
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold uppercase tracking-wider text-[#475569]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Produk</th>
                  <th scope="col" className="px-4 py-3.5">Kategori &amp; Satuan</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Harga Toko</th>
                  <th scope="col" className="px-4 py-3.5 text-center bg-[#F1F5F9]/60 font-bold text-[#0F172A]">
                    Stok Toko Ini ({branchName})
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center text-[#64748B]">
                    Stok Cabang Lain ({isCabang2 ? 'Alfiamart 1' : 'Alfiamart 2'})
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {data.rows.map((p) => {
                  const myStock = p[branchStockKey] ?? 0;
                  const otherStock = isCabang2 ? (p.stock_alfiamart1 ?? 0) : (p.stock_alfiamart2 ?? 0);
                  const inStock = myStock > 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-[#F8FAFC]/80 ${!inStock ? 'bg-[#FEF2F2]/30' : ''}`}
                    >
                      {/* Nama & SKU */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#475569]">
                            {p.sku.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0F172A]">{p.name}</p>
                            <span className="font-mono text-xs text-[#94A3B8]">SKU: {p.sku}</span>
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

                      {/* Harga */}
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <span className="text-base font-bold font-mono text-[#D6212A]">
                          {rupiah(p.price)}
                        </span>
                      </td>

                      {/* Stok Cabang Saat Ini */}
                      <td className="px-4 py-4 text-center whitespace-nowrap bg-[#F1F5F9]/30">
                        {myStock > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ECFDF5] px-3 py-1.5 text-sm font-black font-mono text-[#047857] border border-[#A7F3D0]">
                            {myStock} {p.unit}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#FEF2F2] px-3 py-1.5 text-xs font-bold text-[#DC2626] border border-[#FECACA]">
                            Habis (0)
                          </span>
                        )}
                      </td>

                      {/* Stok Cabang Lain (Bisa dicek jika pelanggan bertanya) */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold font-mono text-[#64748B] border border-[#E2E8F0]">
                          {otherStock > 0 ? `${otherStock} ${p.unit}` : 'Kosong'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {myStock > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#047857] border border-[#A7F3D0]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                            Tersedia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#B91C1C] border border-[#FECACA]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                            Perlu Restok
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
