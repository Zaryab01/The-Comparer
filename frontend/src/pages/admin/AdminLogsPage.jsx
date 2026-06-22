import { useEffect, useState } from "react";
import { listLogs } from "../../api/admin";

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl card-neon p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold text-brand-700/60 uppercase tracking-wide">{label}</span>
      <span className="font-serif text-2xl font-bold text-brand-950">{value}</span>
    </div>
  );
}

export default function AdminLogsPage() {
  const [data, setData]       = useState(null);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    listLogs(page)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16 text-brand-700/60">
        <span className="w-6 h-6 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-600">Could not load logs.</p>;
  }

  const { stats, results, num_pages } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total comparisons" value={stats.total} />
        <StatCard label="Last 7 days" value={stats.last_7_days} />
        <StatCard label="Avg duration (ms)" value={stats.avg_duration_ms} />
      </div>

      <div className="rounded-2xl card-neon overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700/70 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">When</th>
              <th className="text-left font-semibold px-4 py-2.5">Notes (T/M/B)</th>
              <th className="text-left font-semibold px-4 py-2.5">Brand scope</th>
              <th className="text-left font-semibold px-4 py-2.5">Top result</th>
              <th className="text-right font-semibold px-4 py-2.5">ms</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-brand-700/50 italic">No comparisons logged yet.</td></tr>
            )}
            {results.map((r, i) => (
              <tr key={i} className="border-t border-brand-100">
                <td className="px-4 py-2.5 text-brand-700 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-brand-900">
                  {r.note_counts.top}/{r.note_counts.middle}/{r.note_counts.base}
                </td>
                <td className="px-4 py-2.5 text-brand-700">
                  {r.brand_filter?.length ? r.brand_filter.join(", ") : "—"}
                </td>
                <td className="px-4 py-2.5 text-brand-900">
                  {r.top_result
                    ? <span>{r.top_result.name} <span className="text-brand-700/50">· {r.top_result.score}%</span></span>
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-brand-700">{r.duration_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {num_pages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-4 py-1.5 rounded-full border border-brand-300 text-sm text-brand-900
                       hover:bg-brand-50 disabled:opacity-40 transition-colors">
            ← Prev
          </button>
          <span className="text-sm text-brand-700/60">Page {page} of {num_pages}</span>
          <button type="button" disabled={page >= num_pages} onClick={() => setPage((p) => p + 1)}
            className="px-4 py-1.5 rounded-full border border-brand-300 text-sm text-brand-900
                       hover:bg-brand-50 disabled:opacity-40 transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
