import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errorMessage } from '../api/client.js';
import { Store, AlertCircle } from 'lucide-react';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'owner' ? '/produk' : '/kasir'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      navigate(u.role === 'owner' ? '/produk' : '/kasir', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F5]">
      {/* Strip merek atas */}
      <div className="bg-[#D6212A] px-4 py-5 text-white">
        <div className="mx-auto max-w-sm">
          <div className="flex items-center gap-2">
            <Store size={24} />
            <span className="text-xl font-bold tracking-tight">SRC Alfiamart</span>
          </div>
          <p className="mt-1 text-sm text-white/80">Sistem Kasir &amp; Manajemen Toko</p>
        </div>
      </div>

      {/* Form login */}
      <div className="mx-auto w-full max-w-sm flex-1 px-4 py-8">
        <form
          onSubmit={submit}
          className="rounded-xl border border-[#E3E5E8] bg-white p-6 shadow-sm"
          noValidate
        >
          <h1 className="mb-5 text-lg font-bold">Masuk ke akun Anda</h1>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="contoh@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Kata sandi</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Error — ikon + teks, bukan hanya warna */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#F4B8B8] bg-[#FCEAEA] px-3 py-2.5 text-sm text-[#A01520]"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={busy || !email || !password}
            >
              {busy ? 'Memeriksa…' : 'Masuk'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-[#5F6670]">
          Hanya untuk staf toko. Lihat harga produk di{' '}
          <a href="/katalog" className="font-semibold text-[#D6212A] underline">
            katalog publik
          </a>
          .
        </p>
      </div>
    </div>
  );
}
