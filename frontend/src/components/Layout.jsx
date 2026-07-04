import { useEffect, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import PrismaticBurst from "./PrismaticBurst";

// Flip to `true` to bring back the animated PrismaticBurst background + dark
// theme. Kept in code so the burst is one switch away (see git history for the
// matching dark styling in index.css / pages).
const SHOW_BURST = false;

const navClass = ({ isActive }) =>
  `text-sm font-medium transition-colors duration-150 ${
    isActive
      ? "text-white border-b-2 border-gold pb-0.5"
      : "text-white/60 hover:text-white"
  }`;

export default function Layout() {
  const bgRef = useRef(null);

  // When the burst is shown it sits behind all content, so forward window
  // pointer movement to its container to drive animationType="hover".
  useEffect(() => {
    if (!SHOW_BURST) return;
    const forward = (e) => {
      const el = bgRef.current?.firstElementChild;
      if (el) {
        el.dispatchEvent(
          new PointerEvent("pointermove", { clientX: e.clientX, clientY: e.clientY })
        );
      }
    };
    window.addEventListener("pointermove", forward, { passive: true });
    return () => window.removeEventListener("pointermove", forward);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* ── Optional animated background (off by default) ── */}
      {SHOW_BURST && (
        <div ref={bgRef} className="fixed inset-0 -z-10 bg-black pointer-events-none">
          <PrismaticBurst
            animationType="hover"
            intensity={1.5}
            speed={1}
            distort={0}
            paused={false}
            offset={{ x: 0, y: 0 }}
            hoverDampness={0}
            rayCount={5}
            mixBlendMode="lighten"
            colors={["#aa0000", "#F43F5E", "#ff0000"]}
          />
        </div>
      )}

      {/* ── Header — solid black, editorial contrast ── */}
      <header className="bg-brand-900 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Brand */}
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Fragrance Comparer
            </h1>
            <p className="text-xs text-white/50 tracking-wide mt-0.5">
              31 000+ perfumes · note-by-note matching
            </p>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-5">
            <NavLink to="/" end className={navClass}>Compare</NavLink>
            <NavLink to="/catalog" className={navClass}>External Brands Database</NavLink>
            <NavLink to="/profiles" className={navClass}>Saved Perfumes</NavLink>
            <NavLink to="/admin" className={navClass}>Admin</NavLink>

            <div className="flex items-center gap-1.5 ml-2 pl-4 border-l border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="text-xs text-white/50">API live</span>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Page content ── */}
      <Outlet />

      {/* ── Footer ── */}
      <footer className="border-t border-brand-200 py-6 text-center text-xs text-brand-300">
        Fragrance Comparer · Data sourced from Parfumo
      </footer>
    </div>
  );
}
