import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errorMessage } from '../api/client.js';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      {/* ── Header Merah Elegan dengan Aksen Emas ── */}
      <header className="top-bar">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3 text-white">
            <img src="/putih.png" alt="Logo SRC Alfiamart" className="h-8 w-auto max-w-[110px] object-contain -translate-y-0.5" />
            <span className="text-base font-extrabold tracking-tight leading-none">SRC Alfiamart</span>
          </div>
        </div>
      </header>

      {/* ── Main Container Login ── */}
      <main className="flex flex-1 items-center justify-center p-4 py-10 sm:py-16">
        <div className="w-full max-w-md space-y-6">

          {/* Kartu Form Login */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-7 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#047857] border border-[#A7F3D0] mb-1">
                <ShieldCheck size={14} />
                <span>Autentikasi Staf &amp; Pengelola</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Selamat Datang</h1>
              <p className="text-sm text-[#64748B]">
                Masukkan kredensial akun Anda untuk mengelola kasir dan produk toko.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              {/* Input Email */}
              <div>
                <label htmlFor="email" className="label text-xs uppercase tracking-wider text-[#475569]">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="field !pl-11 h-12 text-sm placeholder:text-[#94A3B8]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nama@email.com"
                  />
                </div>
              </div>

              {/* Input Password */}
              <div>
                <label htmlFor="password" className="label text-xs uppercase tracking-wider text-[#475569]">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="field !pl-11 !pr-11 h-12 text-sm placeholder:text-[#94A3B8]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Masukkan kata sandi"
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Alert Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-xs text-[#991B1B]"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#DC2626]" />
                  <span className="font-medium leading-relaxed">{error}</span>
                </div>
              )}

              {/* Tombol Submit */}
              <button
                type="submit"
                className="btn btn-primary w-full h-12 text-base font-bold shadow-sm mt-2"
                disabled={busy || !email || !password}
              >
                {busy ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Memverifikasi...</span>
                  </div>
                ) : (
                  <span>Masuk ke Sistem</span>
                )}
              </button>
            </form>
          </div>

          {/* Link ke Katalog Publik */}
          <div className="text-center text-xs text-[#64748B]">
            Bukan staf toko? Kunjungi{' '}
            <Link to="/katalog" className="font-semibold text-[#D6212A] hover:underline">
              Katalog Produk &amp; Harga Publik
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
