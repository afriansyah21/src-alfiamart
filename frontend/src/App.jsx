import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Products from './pages/Products.jsx';
import Kasir from './pages/Kasir.jsx';
import Katalog from './pages/Katalog.jsx';
import KelolaKatalog from './pages/KelolaKatalog.jsx';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-slate">Memuat…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/kasir" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/produk" element={<Protected roles={['owner']}><Products /></Protected>} />
        <Route path="/kelola-katalog" element={<Protected roles={['owner']}><KelolaKatalog /></Protected>} />
        <Route path="/kasir" element={<Kasir />} />
      </Route>
      <Route path="/katalog" element={<Katalog />} />
      <Route path="*" element={<Navigate to={user ? (user.role === 'owner' ? '/produk' : '/kasir') : '/login'} replace />} />
    </Routes>
  );
}
