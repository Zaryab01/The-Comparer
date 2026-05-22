import { useState } from "react";
import LayerBreakdown from "./LayerBreakdown";

/**
 * Single comparison result card.
 *
 * @param {{ result: MatchResult, rank: number, noteNames: Object }} props
 */
export default function ResultCard({ result, rank, noteNames }) {
  const [expanded, setExpanded] = useState(rank === 1); // first card open by default

  const {
    perfume_name,
    perfume_brand,
    release_year,
    url,
    overall_score,
    top,
    middle,
    base,
  } = result;

  const scoreColor =
    overall_score >= 70 ? "text-emerald-700" :
    overall_score >= 40 ? "text-amber-700"   :
    "text-brand-700";

  return (
    <article
      className="flex flex-col rounded-2xl border border-brand-200 bg-white
                 shadow-sm hover:shadow-md transition-shadow duration-200
                 overflow-hidden animate-fade-in"
    >
      {/* Rank stripe */}
      <div className={`h-1 w-full ${rank === 1 ? "bg-gold" : rank === 2 ? "bg-brand-700/60" : "bg-brand-200"}`} />

      <div className="flex flex-col gap-4 p-5 flex-1">
        {/* Score + meta */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Rank badge */}
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-700/50 mb-1 block">
              #{rank} match
            </span>

            {/* Perfume name */}
            <h3 className="font-serif text-lg font-bold text-brand-950 leading-tight line-clamp-2">
              {perfume_name}
            </h3>

            {/* Brand · Year */}
            <p className="mt-1 text-sm text-brand-700">
              {perfume_brand && <span>{perfume_brand}</span>}
              {perfume_brand && release_year && <span className="mx-1.5 opacity-40">·</span>}
              {release_year && <span>{release_year}</span>}
            </p>
          </div>

          {/* Score circle */}
          <div className="shrink-0 flex flex-col items-center">
            <span className={`text-2xl font-bold font-serif tabular-nums ${scoreColor}`}>
              {overall_score.toFixed(1)}
              <span className="text-base font-normal">%</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-brand-700/50">match</span>
          </div>
        </div>

        {/* External link */}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gold
                       hover:text-brand-900 transition-colors duration-150
                       underline-offset-2 hover:underline"
          >
            View on Parfumo
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 10L10 2M10 2H5M10 2v5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}

        {/* Divider */}
        <div className="h-px bg-brand-100" />

        {/* Breakdown toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-left
                     text-xs font-semibold uppercase tracking-wider text-brand-700
                     hover:text-brand-950 transition-colors duration-150"
        >
          <span>Why this matched</span>
          <span
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </button>

        {/* Breakdown rows */}
        {expanded && (
          <div className="flex flex-col gap-3 animate-fade-in">
            {["top", "middle", "base"].map((layer) => (
              <LayerBreakdown
                key={layer}
                layer={layer}
                data={result[layer]}
                noteNames={noteNames}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
