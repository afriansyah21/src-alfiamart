import axios from 'axios';

export const TOKEN_KEY = 'src_token';

// Dev: '/api/v1' lewat proxy Vite. Produksi: isi VITE_API_URL.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Sesi habis: bersihkan token dan beri tahu AuthProvider (kecuali saat login)
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  },
);

// Pesan error yang ramah pengguna, dari format error API ({ error: { message, details } })
export function errorMessage(err) {
  if (!err.response) return 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.';
  const e = err.response.data?.error;
  if (!e) return 'Terjadi kesalahan. Coba lagi.';
  const details = Array.isArray(e.details) && e.details.length ? `: ${e.details.map((d) => d.message).join('; ')}` : '';
  return `${e.message}${details}`;
}

export default api;
