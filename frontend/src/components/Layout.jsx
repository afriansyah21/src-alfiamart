import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { LayoutGrid, ShoppingCart, LogOut, Store, BookOpen, ShieldCheck } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const desktopNavClass = ({ isActive }) =>
    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
      isActive
        ? 'bg-white/20 text-white shadow-xs'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header Merah Solid dengan Garis Aksen Kuning Emas Elegan ── */}
      <header className="top-bar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#D6212A] shadow-xs">
              <Store size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-white">SRC Alfiamart</span>
                <span className="hidden sm:inline-flex rounded-md bg-[#FFC72C] px-1.5 py-0.2 text-[10px] font-black uppercase text-[#3A2A00]">
                  POS
                </span>
              </div>
              <p className="text-[11px] text-white/75 font-medium leading-none">Minimarket POS &amp; Inventory</p>
            </div>
          </div>

          {/* Navigasi Desktop Modern */}
          <nav className="hidden items-center gap-1.5 md:flex" aria-label="Menu utama">
            {user.role === 'owner' && (
              <NavLink to="/produk" className={desktopNavClass}>
                <LayoutGrid size={17} />
                <span>Katalog Owner</span>
              </NavLink>
            )}
            <NavLink to="/kasir" className={desktopNavClass}>
              <ShoppingCart size={17} />
              <span>Kasir POS</span>
            </NavLink>
            <NavLink to="/katalog" className={desktopNavClass}>
              <BookOpen size={17} />
              <span>Katalog Publik</span>
            </NavLink>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-white leading-tight">{user.name}</span>
              <span className="text-[11px] text-white/80 capitalize flex items-center justify-end gap-1">
                <ShieldCheck size={12} className="text-[#FFC72C]" />
                {user.role === 'owner' ? 'Owner / Pengelola' : 'Petugas Kasir'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-white/20 cursor-pointer"
              aria-label="Keluar"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Konten ── */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {/* ── Tab Bar Bawah Mobile ── */}
      <nav className="tab-bar md:hidden" aria-label="Navigasi bawah">
        {user.role === 'owner' && (
          <NavLink
            to="/produk"
            className={({ isActive }) => isActive ? 'active-tab' : ''}
          >
            <LayoutGrid size={20} />
            <span>Katalog</span>
          </NavLink>
        )}
        <NavLink
          to="/kasir"
          className={({ isActive }) => isActive ? 'active-tab' : ''}
        >
          <ShoppingCart size={20} />
          <span>Kasir</span>
        </NavLink>
        <NavLink
          to="/katalog"
          className={({ isActive }) => isActive ? 'active-tab' : ''}
        >
          <BookOpen size={20} />
          <span>Publik</span>
        </NavLink>
      </nav>
    </div>
  );
}
