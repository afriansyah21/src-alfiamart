import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { dateTime, rupiah } from '../format.js';
import { deleteOutbox, getMeta, getOutbox, getProducts, putOutbox } from '../offline/db.js';
import { refreshProducts, syncOutbox } from '../offline/sync.js';
import { useToast } from '../components/Toast.jsx';
import {
  Search, ShoppingCart, Wifi, WifiOff, RefreshCw, Send,
  Plus, Minus, Trash2, AlertCircle, Package, X, CheckCircle2,
  Clock, XCircle, CreditCard, Banknote, QrCode, Tag
} from 'lucide-react';

const PAYMENTS = [
  { id: 'tunai', label: 'Tunai', icon: Banknote },
  { id: 'qris', label: 'QRIS', icon: QrCode },
  { id: 'transfer', label: 'Transfer', icon: CreditCard }
];

const STATUS = {
  tertunda: { label: 'Menunggu Kirim', cls: 'badge-pending' },
  berhasil: { label: 'Terkirim',       cls: 'badge-ok'      },
  gagal:    { label: 'Gagal',          cls: 'badge-fail'    },
};
const SHOW_MAX = 60;

const uuid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

function initials(name) {
  const words = name.trim().split(/\s+/);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

export default function Kasir() {
  const toast = useToast();
  const [products, setProducts]     = useState([]);
  const [updatedAt, setUpdatedAt]   = useState(null);
  const [q, setQ]                   = useState('');
  const [cart, setCart]             = useState({});
  const [payment, setPayment]       = useState('tunai');
  const [outbox, setOutbox]         = useState([]);
  const [online, setOnline]         = useState(navigator.onLine);
  const [syncing, setSyncing]       = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [sheetOpen, setSheetOpen]   = useState(false);

  const reloadOutbox = useCallback(async () => setOutbox(await getOutbox()), []);

  const loadLocal = useCallback(async () => {
    const list = await getProducts();
    setProducts(list.sort((a, b) => a.name.localeCompare(b.name, 'id')));
    setUpdatedAt(await getMeta('products_updated_at'));
    await reloadOutbox();
  }, [reloadOutbox]);

  const fetchPrices = useCallback(async (manual = false) => {
    try {
      const { rows, at } = await refreshProducts();
      setProducts(rows.sort((a, b) => a.name.localeCompare(b.name, 'id')));
      setUpdatedAt(at);
      setServerDown(false);
      if (manual) toast.success('Harga terbaru berhasil dimuat');
    } catch (err) {
      if (!err.response) setServerDown(true);
      if (manual) toast.error(errorMessage(err));
    }
  }, [toast]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await syncOutbox();
      if (r.skipped) return;
      setServerDown(r.networkError);
      if (r.synced) { toast.success(`${r.synced} transaksi berhasil disinkronisasi`); fetchPrices(); }
      if (r.failed) toast.error(`${r.failed} transaksi ditolak. Periksa daftar antrean.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSyncing(false);
      await reloadOutbox();
    }
  }, [toast, fetchPrices, reloadOutbox]);

  useEffect(() => {
    (async () => {
      await loadLocal();
      if (navigator.onLine) { await fetchPrices(); await doSync(); }
    })();
  }, [loadLocal, fetchPrices, doSync]);

  useEffect(() => {
    const goOnline  = () => { setOnline(true); doSync(); fetchPrices(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [doSync, fetchPrices]);

  const pending = outbox.filter((t) => t.status === 'tertunda').length;
  useEffect(() => {
    if (!pending || !online) return undefined;
    const id = setInterval(doSync, 20000);
    return () => clearInterval(id);
  }, [pending, online, doSync]);

  /* ---- Kalkulasi Keranjang ---- */
  const byId  = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.values(cart).map((l) => ({ ...l, price: byId.get(l.id)?.price ?? l.price }));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add    = (p) => setCart((c) => ({ ...c, [p.id]: { id: p.id, name: p.name, price: p.price, qty: Math.min(1000, (c[p.id]?.qty || 0) + 1) } }));
  const setQty = (id, qty) => setCart((c) => {
    if (!Number.isFinite(qty) || qty < 1) return c;
    return { ...c, [id]: { ...c[id], qty: Math.min(1000, Math.floor(qty)) } };
  });
  const remove = (id) => setCart((c) => { const { [id]: _, ...rest } = c; return rest; });

  const submit = async () => {
    if (lines.length === 0) return;
    const now = new Date().toISOString();
    await putOutbox({
      client_id: uuid(), payment_method: payment, occurred_at: now, created_at: now, status: 'tertunda', total,
      items: lines.map((l) => ({ product_id: l.id, name: l.name, qty: l.qty, unit_price: l.price })),
    });
    setCart({});
    setSheetOpen(false);
    await reloadOutbox();
    toast.success(online ? 'Transaksi berhasil disimpan' : 'Tersimpan di perangkat (offline)');
    if (navigator.onLine) doSync();
  };

  const retry   = async (t) => { await putOutbox({ ...t, status: 'tertunda', error: undefined }); await reloadOutbox(); doSync(); };
  const discard = async (t) => {
    if (!window.confirm('Buang transaksi ini dari perangkat? Data tidak dapat dikembalikan.')) return;
    await deleteOutbox(t.client_id); await reloadOutbox();
  };

  const needle   = q.trim().toLowerCase();
  const filtered = needle ? products.filter((p) => p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)) : products;
  const shown    = filtered.slice(0, SHOW_MAX);

  return (
    <div className="space-y-6 pb-28 lg:pb-8">
      {/* ── Status Bar Kasir & Sinkronisasi ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            online ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]' : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
          }`}>
            {online ? <Wifi size={14} className="animate-pulse" /> : <WifiOff size={14} />}
            <span>{online ? 'Mode Online' : 'Mode Offline'}</span>
          </div>

          {updatedAt && (
            <span className="hidden text-xs text-[#64748B] sm:inline">
              Sync harga: <strong className="text-[#334155]">{dateTime(updatedAt)}</strong>
            </span>
          )}

          {pending > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#B45309] border border-[#FDE68A]">
              <Clock size={13} />
              <span>{pending} antrean transaksi</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchPrices(true)}
            disabled={!online}
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Perbarui Katalog</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={doSync}
            disabled={!online || syncing || pending === 0}
          >
            <Send size={14} />
            <span>{syncing ? 'Sinkronisasi...' : `Kirim Antrean (${pending})`}</span>
          </button>
        </div>
      </div>

      {/* ── Grid Utama Kasir: Panel Produk & Keranjang Desktop ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">

        {/* ---- Bagian Kiri: Pencarian & Grid Produk ---- */}
        <section aria-label="Daftar produk" className="space-y-4">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <label htmlFor="cari" className="sr-only">Cari produk kasir</label>
            <input
              id="cari"
              type="search"
              className="field pl-10 h-12 text-sm shadow-xs placeholder:text-[#94A3B8]"
              placeholder="Ketik nama produk atau scan SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white py-16 text-center">
              <Package size={44} className="mb-2 text-[#CBD5E1]" />
              <p className="font-semibold text-[#0F172A]">
                {online ? 'Sedang memuat katalog toko...' : 'Belum ada data produk tersimpan.'}
              </p>
              {!online && <p className="text-xs text-[#64748B] mt-1">Sambungkan koneksi internet sekali untuk mengambil data harga.</p>}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-[#64748B]">
              Produk dengan kata kunci &quot;{q}&quot; tidak ditemukan.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                const inCart = cart[p.id]?.qty;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="product-card group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D6212A]"
                    onClick={() => add(p)}
                    aria-label={`Tambah ${p.name}, ${rupiah(p.price)}`}
                  >
                    {/* Placeholder Gambar Produk Modern */}
                    <div className="img-placeholder bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] border-b border-[#E2E8F0]">
                      <span className="font-bold text-xl tracking-wider text-[#94A3B8] group-hover:text-[#D6212A] transition-colors">
                        {initials(p.name)}
                      </span>
                      {inCart && (
                        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D6212A] text-[11px] font-bold text-white shadow-xs">
                          {inCart}
                        </div>
                      )}
                    </div>

                    {/* Informasi Produk & Harga Bersih */}
                    <div className="flex flex-1 flex-col p-3.5">
                      <p className="line-clamp-2 text-sm font-semibold text-[#1E293B] group-hover:text-[#D6212A] transition-colors">
                        {p.name}
                      </p>
                      <span className="mt-0.5 text-xs text-[#94A3B8]">
                        per {p.unit} &middot; {p.sku}
                      </span>

                      <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2">
                        {/* Harga Toko Bersih Tanpa Background Norak */}
                        <span className="text-base font-bold font-mono text-[#D6212A]">
                          {rupiah(p.price)}
                        </span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F5F9] text-[#475569] group-hover:bg-[#D6212A] group-hover:text-white transition-all">
                          <Plus size={15} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length > SHOW_MAX && (
            <p className="text-center text-xs text-[#64748B]">
              Menampilkan {SHOW_MAX} dari {filtered.length} produk. Gunakan kolom pencarian untuk hasil lebih spesifik.
            </p>
          )}
        </section>

        {/* ---- Bagian Kanan: Keranjang Kasir POS (Desktop Sticky) ---- */}
        <section
          id="keranjang"
          aria-label="Keranjang"
          className="hidden lg:flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-xs sticky top-20 h-fit max-h-[calc(100vh-6rem)] overflow-hidden"
        >
          {/* Header Keranjang */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4 bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <ShoppingCart size={19} className="text-[#D6212A]" />
              <h2 className="font-bold text-base text-[#0F172A]">Keranjang Transaksi</h2>
            </div>
            {count > 0 && (
              <span className="rounded-full bg-[#D6212A] px-2.5 py-0.5 text-xs font-bold text-white">
                {count} item
              </span>
            )}
          </div>

          {/* List Item Keranjang */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-[#F1F5F9] max-h-72">
            {lines.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart size={32} className="mx-auto mb-2 text-[#CBD5E1]" />
                <p className="text-sm font-medium text-[#64748B]">Keranjang belanja kosong</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">Pilih produk di sebelah kiri untuk menambah.</p>
              </div>
            ) : (
              lines.map((l) => (
                <div key={l.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-[#1E293B] line-clamp-1">{l.name}</p>
                    <span className="font-mono font-bold text-sm text-[#0F172A] shrink-0">
                      {rupiah(l.price * l.qty)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 border border-[#E2E8F0] rounded-lg p-0.5 bg-[#F8FAFC]">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white hover:bg-[#F1F5F9] text-[#475569] shadow-xs"
                        aria-label={`Kurangi ${l.name}`}
                        onClick={() => (l.qty > 1 ? setQty(l.id, l.qty - 1) : remove(l.id))}
                      >
                        {l.qty > 1 ? <Minus size={13} /> : <Trash2 size={13} className="text-[#DC2626]" />}
                      </button>
                      <input
                        aria-label={`Jumlah ${l.name}`}
                        className="w-10 text-center font-semibold text-xs bg-transparent border-0 focus:outline-none"
                        inputMode="numeric"
                        value={l.qty}
                        onChange={(e) => setQty(l.id, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white hover:bg-[#F1F5F9] text-[#475569] shadow-xs"
                        aria-label={`Tambah ${l.name}`}
                        onClick={() => setQty(l.id, l.qty + 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <span className="text-xs text-[#64748B]">
                      @ {rupiah(l.price)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Pembayaran & Total */}
          <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#475569]">Total Pembayaran</span>
              <span className="text-2xl font-black font-mono text-[#D6212A]" data-testid="total">
                {rupiah(total)}
              </span>
            </div>

            {/* Pilihan Metode Bayar */}
            <div>
              <span className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">
                Metode Pembayaran
              </span>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENTS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPayment(id)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      payment === id
                        ? 'bg-[#D6212A] text-white border-[#D6212A] shadow-xs'
                        : 'bg-white text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary w-full h-12 text-base font-bold shadow-sm"
              disabled={lines.length === 0}
              onClick={submit}
            >
              Simpan Transaksi
            </button>
          </div>
        </section>
      </div>

      {/* ── Riwayat Transaksi Offline di Perangkat ── */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div>
            <h2 className="font-bold text-base text-[#0F172A]">Antrean Transaksi Perangkat</h2>
            <p className="text-xs text-[#64748B]">
              Semua transaksi kasir di perangkat ini disimpan lokal secara aman.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#64748B]">
            {outbox.length} tercatat
          </span>
        </div>

        {outbox.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#94A3B8]">
            Belum ada transaksi yang dibuat pada sesi perangkat ini.
          </p>
        ) : (
          <div className="divide-y divide-[#E2E8F0] overflow-hidden rounded-xl border border-[#E2E8F0]">
            {outbox.slice(0, 10).map((t) => (
              <div key={t.client_id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-[#F8FAFC]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-mono text-sm text-[#0F172A]">{rupiah(t.total)}</span>
                    <span className="text-xs text-[#64748B]">&middot; {t.items.reduce((s, i) => s + i.qty, 0)} item</span>
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#475569]">
                      {t.payment_method}
                    </span>
                  </div>
                  <span className="text-xs text-[#94A3B8]">{dateTime(t.occurred_at)}</span>
                  {t.status === 'gagal' && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#DC2626]">
                      <XCircle size={13} /> {t.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`badge ${STATUS[t.status].cls}`}>
                    {STATUS[t.status].label}
                  </span>
                  {t.status === 'gagal' && (
                    <div className="flex gap-1.5">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry(t)}>Coba Lagi</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => discard(t)}>Buang</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Cart Bar Mobile (Bottom Bar Floating) ── */}
      <button
        type="button"
        className="cart-bar lg:hidden cursor-pointer"
        onClick={() => setSheetOpen(true)}
        aria-label={`Buka keranjang, ${count} barang, total ${rupiah(total)}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#FFC72C]">
            <ShoppingCart size={20} />
          </div>
          <div className="text-left">
            <span className="block text-xs text-[#94A3B8]">{count} Barang dipilih</span>
            <span className="font-bold font-mono text-base text-white" data-testid="total">{rupiah(total)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-[#FFC72C] bg-white/10 px-3 py-1.5 rounded-lg">
          <span>Checkout</span>
          <span>&rarr;</span>
        </div>
      </button>

      {/* ── Bottom Sheet Keranjang Kasir Mobile ── */}
      {sheetOpen && (
        <>
          <div className="sheet-backdrop lg:hidden" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div className="sheet lg:hidden" role="dialog" aria-modal="true" aria-label="Keranjang belanja">
            <div className="sheet-handle" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#D6212A]" />
                <h2 className="font-bold text-base text-[#0F172A]">Detail Keranjang ({count} item)</h2>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSheetOpen(false)} aria-label="Tutup keranjang">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#94A3B8]">Keranjang masih kosong.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] max-h-64 overflow-y-auto">
                  {lines.map((l) => (
                    <div key={l.id} className="py-3">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-sm text-[#0F172A]">{l.name}</span>
                        <span className="font-mono font-bold text-sm text-[#D6212A]">{rupiah(l.price * l.qty)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-lg p-1 bg-[#F8FAFC]">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#475569]"
                            onClick={() => (l.qty > 1 ? setQty(l.id, l.qty - 1) : remove(l.id))}
                          >
                            {l.qty > 1 ? <Minus size={13} /> : <Trash2 size={13} className="text-[#DC2626]" />}
                          </button>
                          <span className="w-8 text-center font-bold text-xs">{l.qty}</span>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#475569]"
                            onClick={() => setQty(l.id, l.qty + 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <span className="text-xs text-[#64748B]">@ {rupiah(l.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Sheet */}
              <div className="border-t border-[#E2E8F0] pt-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[#475569]">Total Pembayaran</span>
                <span className="text-2xl font-black font-mono text-[#D6212A]">{rupiah(total)}</span>
              </div>

              {/* Metode Bayar Mobile */}
              <div>
                <span className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">
                  Metode Pembayaran
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENTS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPayment(id)}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                        payment === id
                          ? 'bg-[#D6212A] text-white border-[#D6212A]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary w-full h-12 text-base font-bold shadow-sm"
                disabled={lines.length === 0}
                onClick={submit}
              >
                Simpan Transaksi
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
