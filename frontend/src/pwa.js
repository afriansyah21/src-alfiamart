// Mendaftarkan service worker hanya pada build produksi (bukan saat npm run dev)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker gagal didaftarkan', err));
  });
}
