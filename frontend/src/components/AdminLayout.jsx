import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { adminLogout } from "../api/admin";

const tabClass = ({ isActive }) =>
  `px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
    isActive ? "bg-gold text-white" : "text-white/70 hover:bg-white/10"
  }`;

export default function AdminLayout() {
  const { isAuthed, username, logout } = useAuth();
  const navigate = useNavigate();

  // Gate: redirect to login if not authenticated.
  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  async function handleLogout() {
    try { await adminLogout(); } catch { /* token may already be invalid */ }
    logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-bold text-white drop-shadow-lg">Admin Dashboard</h2>
          <p className="text-sm text-white/60">Signed in as {username}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-white/70 hover:text-gold underline underline-offset-2 transition-colors"
        >
          Sign out
        </button>
      </div>

      <nav className="flex gap-2 border-b border-white/15 pb-3">
        <NavLink to="/admin/perfumes" className={tabClass}>Perfumes</NavLink>
        <NavLink to="/admin/notes" className={tabClass}>Notes &amp; Aliases</NavLink>
        <NavLink to="/admin/logs" className={tabClass}>Logs</NavLink>
      </nav>

      <Outlet />
    </main>
  );
}
