import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { LayoutGrid, ShoppingCart, LogOut, Store } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  /* Nav item untuk desktop (header atas) */
  const desktopNavClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-white/20 text-white'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  return (
    <div className="min-h-screen pb-16 lg:pb-0">
      {/* ── Header merah (sticky) ── */}
      <header className="top-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Merek */}
          <div className="flex items-center gap-2">
            <Store size={20} />
            <span className="text-base font-bold tracking-tight">SRC Alfiamart</span>
          </div>

          {/* Nav desktop — tersembunyi di mobile */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Menu utama">
            {user.role === 'owner' && (
              <NavLink to="/produk" className={desktopNavClass}>
                Produk &amp; Harga
              </NavLink>
            )}
            <NavLink to="/kasir" className={desktopNavClass}>
              Kasir
            </NavLink>
            <NavLink to="/katalog" className={desktopNavClass}>
              Katalog
            </NavLink>
          </nav>

          {/* Info pengguna + keluar desktop */}
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/80 lg:block">
              {user.name} &middot; {user.role === 'owner' ? 'Pemilik' : 'Kasir'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
              aria-label="Keluar"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Konten halaman ── */}
      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>

      {/* ── Tab bar bawah (ponsel saja) ── */}
      <nav className="tab-bar lg:hidden" aria-label="Navigasi utama">
        {user.role === 'owner' && (
          <NavLink
            to="/produk"
            className={({ isActive }) => isActive ? 'active-tab' : ''}
          >
            <LayoutGrid size={22} />
            <span>Produk</span>
          </NavLink>
        )}
        <NavLink
          to="/kasir"
          className={({ isActive }) => isActive ? 'active-tab' : ''}
        >
          <ShoppingCart size={22} />
          <span>Kasir</span>
        </NavLink>
      </nav>
    </div>
  );
}
