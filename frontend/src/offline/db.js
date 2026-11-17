// Penyimpanan lokal kasir (IndexedDB), tanpa library tambahan.
//  products : salinan produk aktif + harga terakhir yang diterima (dipakai saat offline)
//  outbox   : SEMUA transaksi disimpan di sini dulu sebelum dikirim, sehingga tidak hilang
//  meta     : catatan kecil (mis. waktu harga terakhir diperbarui)
const DB_NAME = 'src-kasir';
const VERSION = 1;

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('products', { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'client_id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const all = (store) => run(store, 'readonly', (s) => s.getAll());

export const getProducts = () => all('products');
export async function replaceProducts(list) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const s = tx.objectStore('products');
    s.clear();
    list.forEach((p) => s.put(p));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export const getOutbox = async () => (await all('outbox')).sort((a, b) => b.created_at.localeCompare(a.created_at));
export const putOutbox = (entry) => run('outbox', 'readwrite', (s) => s.put(entry));
export const deleteOutbox = (clientId) => run('outbox', 'readwrite', (s) => s.delete(clientId));

export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put({ key, value }));
export const getMeta = async (key) => (await run('meta', 'readonly', (s) => s.get(key)))?.value;
