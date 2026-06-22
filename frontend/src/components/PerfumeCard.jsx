import { useState } from "react";
import { getPerfume } from "../api/perfumes";

const LAYER_LABELS = { top: "Top", middle: "Middle", base: "Base" };

/**
 * Catalog perfume card: name, concentration, a "View notes" button that
 * lazy-loads the perfume's notes by layer, and a source link.
 *
 * @param {{ perfume: {
 *   perfume_id: string, name: string, concentration: string|null, url: string|null,
 * } }} props
 */
export default function PerfumeCard({ perfume }) {
  const { perfume_id, name, concentration, url } = perfume;

  const [open, setOpen]       = useState(false);
  const [notes, setNotes]     = useState(null);   // {top, middle, base}
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  async function toggleNotes() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (notes || loading) return;          // already loaded / loading
    setLoading(true);
    setError(false);
    try {
      const detail = await getPerfume(perfume_id);
      setNotes(detail.notes ?? { top: [], middle: [], base: [] });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const hasAnyNotes = notes && ["top", "middle", "base"].some((l) => notes[l]?.length);

  return (
    <article className="flex flex-col gap-3 rounded-2xl card-neon p-4
                        transition-shadow duration-200">
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-base font-bold text-brand-950 leading-tight line-clamp-2">
          {name}
        </h3>
        {concentration && (
          <span className="text-xs text-brand-700/60">{concentration}</span>
        )}
      </div>

      {/* View notes toggle */}
      <button
        type="button"
        onClick={toggleNotes}
        className="self-start inline-flex items-center gap-1.5 rounded-full border border-brand-300
                   px-3 py-1 text-xs font-semibold text-brand-900 hover:bg-brand-50
                   active:scale-95 transition-all duration-150"
        aria-expanded={open}
      >
        {loading
          ? <span className="w-3 h-3 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
          : <span aria-hidden>{open ? "▾" : "▸"}</span>}
        {open ? "Hide notes" : "View notes"}
      </button>

      {/* Notes panel */}
      {open && !loading && (
        <div className="flex flex-col gap-2 animate-fade-in">
          {error && <p className="text-xs text-red-600">Could not load notes.</p>}
          {!error && !hasAnyNotes && (
            <p className="text-xs text-brand-700/50 italic">No notes recorded for this perfume.</p>
          )}
          {!error && hasAnyNotes && ["top", "middle", "base"].map((layer) =>
            notes[layer]?.length ? (
              <div key={layer} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700/60">
                  {LAYER_LABELS[layer]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {notes[layer].map((n) => (
                    <span
                      key={n.note_id}
                      className="inline-block rounded-full bg-brand-50 border border-brand-200
                                 text-[11px] text-brand-800 px-2 py-0.5"
                    >
                      {n.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      <div className="mt-auto pt-1">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700
                       hover:text-gold transition-colors"
          >
            View source ↗
          </a>
        ) : (
          <span className="text-xs text-brand-300">No source link</span>
        )}
      </div>
    </article>
  );
}
