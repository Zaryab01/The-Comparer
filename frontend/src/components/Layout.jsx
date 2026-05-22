import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-brand-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Brand */}
          <div>
            <h1 className="font-serif text-xl font-bold text-brand-950 tracking-tight">
              Fragrance Comparer
            </h1>
            <p className="text-xs text-brand-700/60 tracking-wide">
              31 000+ perfumes · note-by-note matching
            </p>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "text-brand-950 border-b-2 border-gold pb-0.5"
                    : "text-brand-700 hover:text-brand-950"
                }`
              }
            >
              Compare
            </NavLink>
            <NavLink
              to="/profiles"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "text-brand-950 border-b-2 border-gold pb-0.5"
                    : "text-brand-700 hover:text-brand-950"
                }`
              }
            >
              My Profiles
            </NavLink>

            <div className="flex items-center gap-1.5 ml-2 pl-4 border-l border-brand-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs text-brand-700/50">API live</span>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Page content ── */}
      <Outlet />

      {/* ── Footer ── */}
      <footer className="border-t border-brand-200 py-6 text-center text-xs text-brand-700/40">
        Fragrance Comparer · Data sourced from Parfumo
      </footer>
    </div>
  );
}
