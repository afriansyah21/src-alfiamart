import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Membuat dist/sw.js dari sw.template.js dengan nomor build unik agar cache lama diganti saat ada versi baru.
const serviceWorker = () => ({
  name: 'service-worker',
  apply: 'build',
  generateBundle() {
    const source = fs.readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8').replace('__BUILD_ID__', Date.now().toString(36));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});

// Dev dan preview: permintaan /api diteruskan ke backend sehingga tidak perlu mengatur CORS.
const proxy = { '/api': 'http://localhost:3000' };
export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
