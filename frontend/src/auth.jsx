import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { TOKEN_KEY } from './api/client.js';

const USER_KEY = 'src_user';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const readCachedUser = () => {
  try { return localStorage.getItem(TOKEN_KEY) ? JSON.parse(localStorage.getItem(USER_KEY)) : null; } catch { return null; }
};
const clearSession = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

export function AuthProvider({ children }) {
  // Pengguna terakhir disimpan lokal agar kasir tetap bisa membuka aplikasi saat offline
  const [user, setUser] = useState(readCachedUser);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)) && !readCachedUser());

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api.get('/auth/me')
      .then((res) => { setUser(res.data.data); localStorage.setItem(USER_KEY, JSON.stringify(res.data.data)); })
      .catch((err) => {
        // Hanya sesi yang benar-benar ditolak server yang dihapus; gangguan jaringan tidak mengeluarkan pengguna
        if (err.response) { clearSession(); setUser(null); }
        else if (!readCachedUser()) { clearSession(); setUser(null); }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => { clearSession(); setUser(null); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem(TOKEN_KEY, res.data.data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.data.data.user));
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(() => { clearSession(); setUser(null); }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
