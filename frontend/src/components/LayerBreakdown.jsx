/**
 * Per-layer score row inside a ResultCard breakdown.
 * @param {{ layer: string, data: {score: number, matched_note_ids: string[]} | null, noteNames: Object }} props
 */
export default function LayerBreakdown({ layer, data, noteNames }) {
  const label = { top: "Top", middle: "Middle", base: "Base" }[layer] ?? layer;

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="w-14 text-xs font-semibold uppercase tracking-wider text-brand-700/60">
          {label}
        </span>
        <span className="text-brand-700/40 italic text-xs">not compared</span>
      </div>
    );
  }

  const pct = data.score;
  const matched = data.matched_note_ids;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        {/* Layer label */}
        <span className="w-14 text-xs font-semibold uppercase tracking-wider text-brand-700 shrink-0">
          {label}
        </span>

        {/* Score bar */}
        <div className="flex-1 h-1.5 rounded-full bg-brand-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Numeric score */}
        <span className="text-xs font-semibold text-brand-800 tabular-nums w-10 text-right shrink-0">
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Matched note names */}
      {matched.length > 0 && (
        <p className="pl-[4.25rem] text-xs text-brand-700/70 leading-relaxed">
          {matched
            .map((id) => noteNames[id] ?? id)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
