import api from '../api/client.js';
import { getOutbox, putOutbox, setMeta, replaceProducts } from './db.js';

let running = false;

// Mengirim transaksi yang belum berhasil ke server (POST /transactions/batch).
// Hasil per transaksi: synced / duplicate => 'berhasil', failed => 'gagal' (dengan alasan).
// Kegagalan jaringan TIDAK mengubah status: transaksi tetap 'tertunda' dan dicoba lagi nanti.
export async function syncOutbox() {
  if (running) return { skipped: true };
  running = true;
  try {
    const pending = (await getOutbox()).filter((t) => t.status === 'tertunda').reverse(); // terlama dulu
    if (pending.length === 0) return { synced: 0, failed: 0, networkError: false };

    let synced = 0;
    let failed = 0;
    for (let i = 0; i < pending.length; i += 50) {
      const chunk = pending.slice(i, i + 50);
      let res;
      try {
        res = await api.post('/transactions/batch', {
          transactions: chunk.map((t) => ({
            client_id: t.client_id,
            payment_method: t.payment_method,
            occurred_at: t.occurred_at,
            items: t.items.map(({ product_id, qty, unit_price }) => ({ product_id, qty, unit_price })),
          })),
        });
      } catch (err) {
        if (!err.response) return { synced, failed, networkError: true };
        if (err.response.status === 401) return { synced, failed, networkError: false, unauthorized: true };
        throw err;
      }
      for (const r of res.data.data.results) {
        const entry = chunk.find((t) => t.client_id === r.client_id);
        if (!entry) continue;
        if (r.status === 'failed') {
          failed += 1;
          await putOutbox({ ...entry, status: 'gagal', error: r.error?.message || 'Ditolak server' });
        } else {
          synced += 1;
          await putOutbox({ ...entry, status: 'berhasil', error: undefined, synced_at: new Date().toISOString() });
        }
      }
    }
    return { synced, failed, networkError: false };
  } finally {
    running = false;
  }
}

// Mengambil seluruh produk aktif beserta harga terbaru dan menyimpannya untuk dipakai offline.
export async function refreshProducts() {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const res = await api.get('/products', { params: { page, limit: 200 } });
    rows.push(...res.data.data);
    if (rows.length >= res.data.meta.total || res.data.data.length === 0) break;
  }
  await replaceProducts(rows);
  const at = new Date().toISOString();
  await setMeta('products_updated_at', at);
  return { rows, at };
}
