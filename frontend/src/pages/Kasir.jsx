import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { dateTime, rupiah } from '../format.js';
import { deleteOutbox, getMeta, getOutbox, getProducts, putOutbox } from '../offline/db.js';
import { refreshProducts, syncOutbox } from '../offline/sync.js';
import { useToast } from '../components/Toast.jsx';
import {
  Search, ShoppingCart, Wifi, WifiOff, RefreshCw, Send,
  Plus, Minus, Trash2, AlertCircle, Package, X, CheckCircle2,
  Clock, XCircle,
} from 'lucide-react';

const PAYMENTS = [['tunai', 'Tunai'], ['qris', 'QRIS'], ['transfer', 'Transfer']];
const STATUS = {
  tertunda: { label: 'Menunggu kirim', cls: 'badge-pending' },
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

/* Inisial 2 huruf untuk placeholder kartu produk */
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
      if (manual) toast.success('Harga terbaru sudah dimuat');
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
      if (r.synced) { toast.success(`${r.synced} transaksi berhasil dikirim`); fetchPrices(); }
      if (r.failed) toast.error(`${r.failed} transaksi ditolak server. Lihat daftar transaksi.`);
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

  /* ---- keranjang ---- */
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
    toast.success(online ? 'Transaksi disimpan' : 'Transaksi disimpan di perangkat, dikirim saat online');
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

  /* ---- banner status ---- */
  let banner = null;
  if (!online)
    banner = { text: 'Offline. Transaksi tetap tercatat dan dikirim otomatis saat online kembali.', type: 'offline' };
  else if (serverDown && pending > 0)
    banner = { text: 'Server belum terhubung. Transaksi tersimpan dan dicoba lagi otomatis.', type: 'warn' };

  /* ---- badge status ikon ---- */
  const StatusIcon = ({ s }) => {
    if (s === 'berhasil') return <CheckCircle2 size={13} />;
    if (s === 'gagal')    return <XCircle size={13} />;
    return <Clock size={13} />;
  };

  return (
    <div className="pb-24 lg:pb-0">
      {/* ── Bilah status online/offline + aksi ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {online
            ? <Wifi size={16} className="text-[#1E7B4F]" />
            : <WifiOff size={16} className="text-[#A01520]" />}
          <span className={`text-sm font-semibold ${online ? 'text-[#1E7B4F]' : 'text-[#A01520]'}`}>
            {online ? 'Online' : 'Offline'}
          </span>
          {updatedAt && (
            <span className="hidden text-xs text-[#5F6670] sm:block">
              · Harga: {dateTime(updatedAt)}
            </span>
          )}
          {pending > 0 && (
            <span className="badge badge-pending">{pending} menunggu kirim</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchPrices(true)}
            disabled={!online}
            aria-label="Perbarui harga"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Perbarui harga</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={doSync}
            disabled={!online || syncing || pending === 0}
          >
            <Send size={14} />
            {syncing ? 'Mengirim…' : `Kirim sekarang${pending ? ` (${pending})` : ''}`}
          </button>
        </div>
      </div>

      {/* Banner offline/server down */}
      {banner && (
        <div
          role="status"
          className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${
            banner.type === 'offline'
              ? 'bg-[#FFF3CD] text-[#92600A]'
              : 'bg-[#FCEAEA] text-[#A01520]'
          }`}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {banner.text}
        </div>
      )}

      {/* ── Layout utama: produk | keranjang desktop ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">

        {/* ---- Panel produk ---- */}
        <section aria-label="Daftar produk">
          {/* Kolom cari */}
          <div className="relative mb-3">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6670]" />
            <label htmlFor="cari" className="sr-only">Cari produk</label>
            <input
              id="cari"
              type="search"
              className="field pl-10"
              placeholder="Cari nama atau SKU produk"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Keadaan kosong / loading */}
          {products.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-[#E3E5E8] bg-white py-16 text-center">
              <Package size={40} className="mb-3 text-[#E3E5E8]" />
              <p className="font-semibold">
                {online ? 'Memuat produk…' : 'Belum ada data produk di perangkat ini.'}
              </p>
              {!online && <p className="mt-1 text-sm text-[#5F6670]">Hubungkan ke internet sekali untuk mengunduh daftar harga.</p>}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-[#E3E5E8] bg-white p-6 text-center text-[#5F6670]">
              Tidak ada produk yang cocok. Coba kata kunci lain.
            </p>
          ) : (
            /* Grid produk: ketuk kartu untuk tambah */
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Daftar produk kasir">
              {shown.map((p) => {
                const inCart = cart[p.id]?.qty;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="product-card w-full text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6212A]"
                      onClick={() => add(p)}
                      aria-label={`Tambah ${p.name}, ${rupiah(p.price)}`}
                    >
                      {/* Placeholder gambar */}
                      <div className="img-placeholder" aria-hidden="true">
                        <span className="text-lg font-bold text-[#5F6670]">{initials(p.name)}</span>
                      </div>
                      {/* Info + tombol + */}
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                        <p className="mb-2 mt-0.5 text-[11px] text-[#5F6670]">per {p.unit}</p>
                        <div className="mt-auto flex items-end justify-between gap-1">
                          <span className="price-tag text-sm">{rupiah(p.price)}</span>
                          {/* Tombol + merah di sudut kanan bawah */}
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D6212A] text-white"
                            aria-hidden="true"
                          >
                            {inCart ? (
                              <span className="text-xs font-bold">{inCart}</span>
                            ) : (
                              <Plus size={15} />
                            )}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {filtered.length > SHOW_MAX && (
            <p className="hint mt-2 text-center">
              Menampilkan {SHOW_MAX} dari {filtered.length} produk. Persempit pencarian.
            </p>
          )}
        </section>

        {/* ---- Keranjang desktop (sticky, hidden di mobile) ---- */}
        <section
          id="keranjang"
          aria-label="Keranjang"
          className="hidden lg:block h-fit rounded-xl border border-[#E3E5E8] bg-white lg:sticky lg:top-20"
        >
          <div className="flex items-center justify-between border-b border-[#E3E5E8] px-4 py-3">
            <h2 className="font-semibold">Keranjang</h2>
            {count > 0 && (
              <span className="rounded-full bg-[#D6212A] px-2 py-0.5 text-xs font-bold text-white">{count}</span>
            )}
          </div>

          <div className="p-4">
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#5F6670]">Ketuk produk untuk menambah ke keranjang.</p>
            ) : (
              <ul className="divide-y divide-[#E3E5E8]">
                {lines.map((l) => (
                  <li key={l.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{l.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-sm">{rupiah(l.price * l.qty)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ width: 30, height: 30 }}
                        aria-label={`Kurangi ${l.name}`}
                        onClick={() => (l.qty > 1 ? setQty(l.id, l.qty - 1) : remove(l.id))}
                      >
                        {l.qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}
                      </button>
                      <input
                        aria-label={`Jumlah ${l.name}`}
                        className="field !min-h-0 w-14 py-1 text-center text-sm"
                        inputMode="numeric"
                        value={l.qty}
                        onChange={(e) => setQty(l.id, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ width: 30, height: 30 }}
                        aria-label={`Tambah ${l.name}`}
                        onClick={() => setQty(l.id, l.qty + 1)}
                      >
                        <Plus size={14} />
                      </button>
                      <span className="hint whitespace-nowrap text-xs">× {rupiah(l.price)}</span>
                      <button
                        type="button"
                        className="ml-auto text-xs font-semibold text-[#A01520] underline"
                        onClick={() => remove(l.id)}
                      >
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Total */}
            <div className="mt-3 flex items-baseline justify-between border-t border-[#E3E5E8] pt-3">
              <span className="font-semibold text-sm">Total ({count} barang)</span>
              <span className="price-tag text-2xl" data-testid="total">{rupiah(total)}</span>
            </div>

            {/* Metode bayar */}
            <fieldset className="mt-3">
              <legend className="label mb-2">Metode bayar</legend>
              <div className="flex gap-2">
                {PAYMENTS.map(([v, label]) => (
                  <label key={v} className={`btn btn-sm flex-1 cursor-pointer ${payment === v ? 'btn-primary' : 'btn-secondary'}`}>
                    <input type="radio" name="payment-desktop" value={v} className="sr-only" checked={payment === v} onChange={() => setPayment(v)} />
                    {label}
                  </label>
                ))}
              </div>
              <p className="hint mt-1 text-xs">Hanya dicatat; pembayaran di luar aplikasi.</p>
            </fieldset>

            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={lines.length === 0}
              onClick={submit}
            >
              Simpan transaksi
            </button>
          </div>
        </section>
      </div>

      {/* ── Daftar transaksi perangkat ── */}
      <section className="mt-8" aria-label="Transaksi di perangkat ini">
        <h2 className="mb-3 font-semibold">Transaksi di perangkat ini</h2>
        {outbox.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#E3E5E8] bg-white px-4 py-8 text-center text-sm text-[#5F6670]">
            Belum ada transaksi.
          </p>
        ) : (
          <ul className="divide-y divide-[#E3E5E8] overflow-hidden rounded-xl border border-[#E3E5E8] bg-white">
            {outbox.slice(0, 15).map((t) => (
              <li key={t.client_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {rupiah(t.total)} &middot; {t.items.reduce((s, i) => s + i.qty, 0)} barang &middot; {t.payment_method}
                  </p>
                  <p className="hint">{dateTime(t.occurred_at)}</p>
                  {t.status === 'gagal' && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#A01520]">
                      <XCircle size={12} /> {t.error}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge ${STATUS[t.status].cls}`}>
                    <StatusIcon s={t.status} />
                    {STATUS[t.status].label}
                  </span>
                  {t.status === 'gagal' && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => retry(t)}>Coba lagi</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => discard(t)}>Buang</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Cart bar ponsel (tombol buka bottom sheet) ── */}
      <button
        type="button"
        className="cart-bar lg:hidden"
        onClick={() => setSheetOpen(true)}
        aria-label={`Buka keranjang, ${count} barang, total ${rupiah(total)}`}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} />
          <span className="font-semibold">{count} barang</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="price-tag text-lg" data-testid="total">{rupiah(total)}</span>
          <span className="text-sm font-semibold text-white/80">Bayar →</span>
        </div>
      </button>

      {/* ── Bottom sheet keranjang (ponsel) ── */}
      {sheetOpen && (
        <>
          <div className="sheet-backdrop lg:hidden" onClick={() => setSheetOpen(false)} aria-hidden="true" />
          <div className="sheet lg:hidden" role="dialog" aria-modal="true" aria-label="Keranjang belanja">
            <div className="sheet-handle" />
            {/* Header sheet */}
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-semibold">Keranjang ({count} barang)</h2>
              <button type="button" className="btn-icon" onClick={() => setSheetOpen(false)} aria-label="Tutup keranjang">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pb-6">
              {lines.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#5F6670]">Keranjang kosong.</p>
              ) : (
                <ul className="divide-y divide-[#E3E5E8]">
                  {lines.map((l) => (
                    <li key={l.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold">{l.name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{rupiah(l.price * l.qty)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: 32, height: 32 }}
                          aria-label={`Kurangi ${l.name}`}
                          onClick={() => (l.qty > 1 ? setQty(l.id, l.qty - 1) : remove(l.id))}
                        >
                          {l.qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}
                        </button>
                        <input
                          aria-label={`Jumlah ${l.name}`}
                          className="field !min-h-0 w-14 py-1 text-center text-sm"
                          inputMode="numeric"
                          value={l.qty}
                          onChange={(e) => setQty(l.id, Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: 32, height: 32 }}
                          aria-label={`Tambah ${l.name}`}
                          onClick={() => setQty(l.id, l.qty + 1)}
                        >
                          <Plus size={14} />
                        </button>
                        <span className="hint text-xs">× {rupiah(l.price)}</span>
                        <button
                          type="button"
                          className="ml-auto text-xs font-semibold text-[#A01520]"
                          onClick={() => remove(l.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Total */}
              <div className="mt-3 flex items-baseline justify-between border-t border-[#E3E5E8] pt-3">
                <span className="font-semibold">Total</span>
                <span className="price-tag text-2xl">{rupiah(total)}</span>
              </div>

              {/* Metode bayar */}
              <fieldset className="mt-4">
                <legend className="label mb-2">Metode bayar</legend>
                <div className="flex gap-2">
                  {PAYMENTS.map(([v, label]) => (
                    <label key={v} className={`btn btn-sm flex-1 cursor-pointer ${payment === v ? 'btn-primary' : 'btn-secondary'}`}>
                      <input type="radio" name="payment-mobile" value={v} className="sr-only" checked={payment === v} onChange={() => setPayment(v)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                className="btn btn-primary mt-4 w-full"
                disabled={lines.length === 0}
                onClick={submit}
              >
                Simpan transaksi
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
