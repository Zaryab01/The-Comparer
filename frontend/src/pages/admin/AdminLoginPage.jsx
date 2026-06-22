import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { adminLogin } from "../../api/admin";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, isAuthed } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  // Already signed in → go straight to the dashboard.
  if (isAuthed) return <Navigate to="/admin/perfumes" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await adminLogin(username.trim(), password);
      login(data.token, data.username);
      navigate("/admin/perfumes", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid credentials, or this account isn't a staff user."
          : "Could not sign in. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl card-neon p-6 flex flex-col gap-5"
      >
        <div>
          <h2 className="font-serif text-2xl font-bold text-brand-950">Admin sign in</h2>
          <p className="text-sm text-brand-700/60 mt-1">Staff access only.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                       focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                       focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="px-6 py-2.5 rounded-full bg-brand-900 text-white font-semibold text-sm
                     hover:bg-brand-800 active:scale-95 disabled:opacity-40 transition-all duration-150"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
