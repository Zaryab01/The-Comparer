import { useCallback, useEffect, useState } from "react";
import { getCatalog } from "../api/catalog";
import BrandMultiSelect from "../components/BrandMultiSelect";
import PerfumeCard from "../components/PerfumeCard";

export default function CatalogPage() {
  const [selected, setSelected]       = useState([]);     // brand names
  const [groups, setGroups]           = useState([]);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState(null);

  // Reset & load whenever the brand selection changes.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCatalog(selected, 1);
      setGroups(data.groups);
      setPage(1);
    } catch {
      setError("Could not load the catalogue. Please make sure the backend is running.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const data = await getCatalog(selected, next);
      setGroups((prev) =>
        prev.map((g) => {
          const fresh = data.groups.find((x) => x.brand === g.brand);
          if (!fresh) return g;
          return { ...g, has_more: fresh.has_more, perfumes: [...g.perfumes, ...fresh.perfumes] };
        })
      );
      setPage(next);
    } catch {
      /* keep existing results on a failed load-more */
    } finally {
      setLoadingMore(false);
    }
  }

  const anyHasMore = groups.some((g) => g.has_more);
  const isDefault  = selected.length === 0;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-8">
      {/* Hero */}
      <section className="text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brand-950 leading-tight mb-3">
          External Brands Database
        </h2>
        <p className="text-brand-700 max-w-xl mx-auto leading-relaxed">
          Explore perfumes grouped by brand. Search and tick brands to focus the
          list, or browse the most-stocked houses by default.
        </p>
      </section>

      {/* Brand picker */}
      <section className="rounded-2xl card-neon p-4 flex flex-col gap-2">
        <span className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
          Filter by brand
        </span>
        <BrandMultiSelect selected={selected} onChange={setSelected} />
        <p className="text-xs text-brand-700/50">
          {isDefault
            ? "Showing featured brands. Search and tick to pick your own."
            : `Showing ${selected.length} selected brand${selected.length !== 1 ? "s" : ""}.`}
        </p>
      </section>

      {/* States */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-brand-700/60">
          <span className="w-4 h-4 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
          Loading catalogue…
        </div>
      )}

      {/* Brand sections */}
      {!loading && groups.map((g) => (
        <section key={g.brand} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-brand-200 pb-2">
            <h3 className="font-serif text-xl font-bold text-brand-950">{g.brand}</h3>
            <span className="text-sm text-brand-700/50 shrink-0">
              {g.total} perfume{g.total !== 1 ? "s" : ""}
            </span>
          </div>

          {g.perfumes.length === 0 ? (
            <p className="text-sm text-brand-700/50 italic">No perfumes for this brand.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.perfumes.map((p) => (
                <PerfumeCard key={p.perfume_id} perfume={p} />
              ))}
            </div>
          )}
        </section>
      ))}

      {!loading && groups.length > 0 && anyHasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-brand-300
                       text-sm font-semibold text-brand-900 hover:bg-brand-50 active:scale-95
                       disabled:opacity-40 transition-all duration-150"
          >
            {loadingMore ? (
              <>
                <span className="w-4 h-4 border-2 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
                Loading…
              </>
            ) : "Load more"}
          </button>
        </div>
      )}

      {!loading && groups.length === 0 && !error && (
        <p className="text-center text-brand-700/50 py-16">No brands to show.</p>
      )}
    </main>
  );
}
