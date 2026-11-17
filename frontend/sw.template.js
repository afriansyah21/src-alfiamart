// Service worker: membuat aplikasi (halaman dan aset) tetap terbuka saat offline.
// Data (produk, transaksi) TIDAK disimpan di sini; itu tugas IndexedDB (src/offline).
const CACHE = 'src-shell-__BUILD_ID__';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch('/index.html', { cache: 'reload' });
    const html = await res.clone().text();
    await cache.put('/index.html', res);
    // Set: Cache.addAll menolak URL ganda, dan index.html menyebut ikon lebih dari sekali
    const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]))]
      .filter((u) => u.startsWith('/assets/') || u.endsWith('.png') || u.endsWith('.webmanifest'));
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // Jaringan dulu (agar versi baru terpakai); bila gagal/lambat, pakai halaman yang tersimpan
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(rej, 4000))]);
        if (res.ok) cache.put('/index.html', res.clone());
        return res;
      } catch {
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }
  // Aset: dari cache dulu, lalu jaringan
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
