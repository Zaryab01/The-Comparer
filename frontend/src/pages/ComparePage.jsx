import { useEffect, useRef, useState } from "react";
import { compareFragrance } from "../api/compare";
import { ApiError } from "../api/client";
import { listGroups, listProfiles } from "../api/profiles";
import { getPerfume, searchPerfumes } from "../api/perfumes";
import BrandMultiSelect from "../components/BrandMultiSelect";
import NoteSelect from "../components/NoteSelect";
import ResultCard from "../components/ResultCard";

const LAYER_HINTS = {
  top:    "First impression — light, volatile notes perceived in the first 15 min",
  middle: "Heart of the fragrance — emerges after the top fades",
  base:   "The lasting foundation — rich, anchoring notes",
};

export default function ComparePage() {
  const [topNotes,    setTopNotes]    = useState([]);
  const [middleNotes, setMiddleNotes] = useState([]);
  const [baseNotes,   setBaseNotes]   = useState([]);

  // ── Perfume database search ─────────────────────────────────────────────────
  const [perfumeQuery,    setPerfumeQuery]    = useState("");
  const [perfumeResults,  setPerfumeResults]  = useState([]);
  const [perfumeSearching, setPerfumeSearching] = useState(false);
  const [selectedPerfume, setSelectedPerfume] = useState(null);   // full detail obj
  const [perfumeLoadErr,  setPerfumeLoadErr]  = useState(null);
  const [showPfDropdown,  setShowPfDropdown]  = useState(false);
  const pfSearchRef = useRef(null);

  // Debounced search
  useEffect(() => {
    const q = perfumeQuery.trim();
    if (q.length < 2) {
      setPerfumeResults([]);
      setShowPfDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setPerfumeSearching(true);
      try {
        const results = await searchPerfumes(q);
        setPerfumeResults(results);
        setShowPfDropdown(true);
      } catch {
        setPerfumeResults([]);
      } finally {
        setPerfumeSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [perfumeQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (pfSearchRef.current && !pfSearchRef.current.contains(e.target)) {
        setShowPfDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePerfumeSelect(perfume) {
    setShowPfDropdown(false);
    setPerfumeQuery(`${perfume.name} — ${perfume.brand}`);
    setPerfumeResults([]);
    setPerfumeLoadErr(null);
    try {
      const detail = await getPerfume(perfume.perfume_id);
      setTopNotes(detail.notes?.top       ?? []);
      setMiddleNotes(detail.notes?.middle ?? []);
      setBaseNotes(detail.notes?.base     ?? []);
      setSelectedPerfume(detail);
      setSelectedProfileId("");   // clear profile selector
      document.getElementById("note-panels")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch {
      setPerfumeLoadErr("Could not load this perfume's notes. Please try again.");
    }
  }

  function clearPerfumeSearch() {
    setPerfumeQuery("");
    setPerfumeResults([]);
    setSelectedPerfume(null);
    setPerfumeLoadErr(null);
    setShowPfDropdown(false);
  }

  // ── Load from saved profile ─────────────────────────────────────────────────
  const [profiles,          setProfiles]          = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  // ── Target selection ────────────────────────────────────────────────────────
  const [target,  setTarget]  = useState("main"); // "main" | "group"
  const [groupId, setGroupId] = useState("");
  const [groups,  setGroups]  = useState([]);
  const [brands,  setBrands]  = useState([]);     // optional brand scope for "main"

  const [isLoading, setIsLoading] = useState(false);
  const [results,   setResults]   = useState(null);
  const [error,     setError]     = useState(null);

  const totalSelected = topNotes.length + middleNotes.length + baseNotes.length;

  const noteNames = Object.fromEntries(
    [...topNotes, ...middleNotes, ...baseNotes].map((n) => [n.note_id, n.name])
  );

  useEffect(() => {
    listGroups().then(setGroups).catch(() => {});
    listProfiles().then(setProfiles).catch(() => {});
  }, []);

  // ── Note helpers ────────────────────────────────────────────────────────────
  function addNote(setter) {
    return (note) =>
      setter((prev) =>
        prev.some((n) => n.note_id === note.note_id) ? prev : [...prev, note]
      );
  }

  function removeNote(setter) {
    return (note_id) => setter((prev) => prev.filter((n) => n.note_id !== note_id));
  }

  // ── Load from saved profile ─────────────────────────────────────────────────
  function handleProfileSelect(e) {
    const pid = e.target.value;
    setSelectedProfileId(pid);
    if (!pid) return;
    const p = profiles.find((pr) => String(pr.id) === pid);
    if (!p) return;
    setTopNotes(p.notes_by_layer?.top       ?? []);
    setMiddleNotes(p.notes_by_layer?.middle ?? []);
    setBaseNotes(p.notes_by_layer?.base     ?? []);
    clearPerfumeSearch();   // clear perfume selector
    document.getElementById("note-panels")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (totalSelected === 0) return;
    if (target === "group" && !groupId) {
      setError("Please select a profile group to compare against.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const extra =
        target === "group"
          ? { target: "group", group_id: Number(groupId) }
          : brands.length
            ? { brands }
            : {};
      const data  = await compareFragrance(
        topNotes.map((n) => n.note_id),
        middleNotes.map((n) => n.note_id),
        baseNotes.map((n) => n.note_id),
        extra,
      );
      setResults(data.results);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 429
            ? "Too many requests — please wait a moment and try again."
            : "The comparison failed. Please check your selections and try again."
        );
      } else {
        setError("Could not reach the server. Please make sure the backend is running.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setTopNotes([]); setMiddleNotes([]); setBaseNotes([]);
    setSelectedProfileId("");
    setBrands([]);
    clearPerfumeSearch();
    setResults(null); setError(null);
  }

  const selectedGroup   = groups.find((g) => String(g.id) === groupId);
  const selectedProfile = profiles.find((p) => String(p.id) === selectedProfileId);

  const profilesByGroupId = groups.reduce((acc, g) => {
    acc[g.id] = profiles.filter((p) => p.group?.id === g.id);
    return acc;
  }, {});
  const ungroupedProfiles = profiles.filter(
    (p) => !groups.some((g) => g.id === p.group?.id)
  );

  return (
    <main className="flex-1 w-full flex flex-col">

      {/* Hero — logo sits over the global animated background */}
      <section className="relative w-full flex flex-col items-center justify-center text-center px-4 py-20 sm:py-28">
        <img
          src="/logo.png"
          alt="Fragrance Comparer"
          className="w-auto h-28 sm:h-36 mb-6 drop-shadow-lg select-none"
          draggable={false}
        />
        <p className="text-white/80 max-w-xl mx-auto leading-relaxed drop-shadow">
          Select notes manually, search for an existing perfume, or load a saved
          profile — then compare against our full catalogue or your own groups.
        </p>
      </section>

      {/* Constrained content below the hero */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-12">

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">

        {/* ── Pre-fill row: database search + saved profile ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Perfume database search */}
          <div
            ref={pfSearchRef}
            className="relative rounded-2xl card-neon p-4 flex flex-col gap-2"
          >
            <span className="text-xs font-semibold text-white uppercase tracking-wide">
              Search existing perfume
            </span>
            <p className="text-xs text-white/60 -mt-1">
              Pre-fills notes from any perfume in the database
            </p>

            {/* Input */}
            <div className="relative">
              {/* Search icon */}
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none"
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>

              <input
                type="text"
                value={perfumeQuery}
                onChange={(e) => {
                  setPerfumeQuery(e.target.value);
                  if (selectedPerfume) setSelectedPerfume(null); // reset on new typing
                }}
                onFocus={() => { if (perfumeResults.length > 0) setShowPfDropdown(true); }}
                placeholder="e.g. Aventus, Bleu de Chanel…"
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-white/25 bg-white/5
                           text-sm text-white placeholder:text-white/40
                           focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                           transition-colors duration-150"
              />

              {/* Clear button */}
              {perfumeQuery && (
                <button
                  type="button"
                  onClick={clearPerfumeSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2
                             text-white/50 hover:text-white transition-colors"
                  title="Clear"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showPfDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30
                              dropdown-dark rounded-xl max-h-60 overflow-y-auto">
                {perfumeSearching && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/60">
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                    Searching…
                  </div>
                )}

                {!perfumeSearching && perfumeResults.length === 0 && (
                  <p className="px-4 py-3 text-sm text-white/50 italic">
                    No perfumes found for &ldquo;{perfumeQuery}&rdquo;
                  </p>
                )}

                {!perfumeSearching && perfumeResults.map((p) => (
                  <button
                    key={p.perfume_id}
                    type="button"
                    onClick={() => handlePerfumeSelect(p)}
                    className="w-full text-left px-4 py-2.5 dropdown-item
                               flex items-baseline justify-between gap-3
                               border-b border-white/10 last:border-0"
                  >
                    <span className="text-sm font-medium text-white truncate">
                      {p.name}
                    </span>
                    <span className="text-xs text-white/50 shrink-0">
                      {p.brand}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Status line */}
            {perfumeLoadErr && (
              <p className="text-xs text-red-600">{perfumeLoadErr}</p>
            )}
            {selectedPerfume && !showPfDropdown && (
              <p className="text-xs text-white/60 italic">
                Notes pre-filled from &ldquo;{selectedPerfume.name}&rdquo; by {selectedPerfume.brand}.
                You can still edit them below.
              </p>
            )}
          </div>

          {/* Load from saved profile */}
          {profiles.length > 0 ? (
            <div className="rounded-2xl card-neon p-4 flex flex-col gap-2">
              <span className="text-xs font-semibold text-white uppercase tracking-wide">
                Load saved perfumes
              </span>
              <p className="text-xs text-white/60 -mt-1">
                Pre-fills notes from one of your custom profiles
              </p>

              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={selectedProfileId}
                  onChange={handleProfileSelect}
                  className="flex-1 px-3 py-2 rounded-lg border border-white/25 bg-brand-900
                             text-sm text-white focus:outline-none focus:border-gold
                             focus:ring-1 focus:ring-gold transition-colors duration-150"
                >
                  <option value="">Select a profile…</option>
                  {groups.map((g) => {
                    const gProfiles = profilesByGroupId[g.id] ?? [];
                    if (gProfiles.length === 0) return null;
                    return (
                      <optgroup key={g.id} label={g.name}>
                        {gProfiles.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} — {p.brand}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {ungroupedProfiles.length > 0 && (
                    <optgroup label="Other">
                      {ungroupedProfiles.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name} — {p.brand}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {selectedProfileId && (
                  <button
                    type="button"
                    onClick={() => setSelectedProfileId("")}
                    title="Clear selection"
                    className="text-white/50 hover:text-white transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                )}
              </div>

              {selectedProfile && (
                <p className="text-xs text-white/60 italic">
                  Notes pre-filled from &ldquo;{selectedProfile.name}&rdquo; by {selectedProfile.brand}.
                  You can still edit them below.
                </p>
              )}
            </div>
          ) : (
            /* Placeholder card when no profiles exist yet */
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5
                            p-4 flex flex-col gap-1 justify-center">
              <span className="text-xs font-semibold text-white uppercase tracking-wide">
                Load saved profile
              </span>
              <p className="text-xs text-white/50 italic">
                No profiles yet.{" "}
                <a href="/profiles" className="underline underline-offset-2 text-white/80 hover:text-white">
                  Create one in My Profiles →
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Note selectors */}
        <div id="note-panels" className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { key: "top",    notes: topNotes,    setter: setTopNotes    },
            { key: "middle", notes: middleNotes, setter: setMiddleNotes },
            { key: "base",   notes: baseNotes,   setter: setBaseNotes   },
          ].map(({ key, notes, setter }) => (
            <div
              key={key}
              className="rounded-2xl card-neon p-4 flex flex-col gap-3"
            >
              <NoteSelect
                label={`${key.charAt(0).toUpperCase() + key.slice(1)} Notes`}
                hint={LAYER_HINTS[key]}
                selectedNotes={notes}
                onAdd={addNote(setter)}
                onRemove={removeNote(setter)}
                dark
              />
            </div>
          ))}
        </div>

        {/* ── Target selector ── */}
        <div className="rounded-2xl card-neon p-5 flex flex-col gap-3">
          <span className="text-xs font-semibold text-white uppercase tracking-wide">
            Compare against
          </span>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Main DB */}
            <label
              className={`flex items-start gap-3 flex-1 cursor-pointer rounded-xl border p-3.5
                          transition-colors duration-150
                          ${target === "main"
                            ? "border-gold bg-gold/10"
                            : "border-white/20 hover:border-white/40"}`}
            >
              <input
                type="radio"
                name="target"
                value="main"
                checked={target === "main"}
                onChange={() => setTarget("main")}
                className="mt-0.5 accent-red-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Main Database</p>
                <p className="text-xs text-white/60 mt-0.5">
                  31,818 perfumes · full Parfumo catalogue
                </p>

                {target === "main" && (
                  <div
                    className="mt-3 rounded-lg border border-gold/50 bg-gold/5 p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gold mb-1.5">
                      Filter by brand (optional)
                    </span>
                    <BrandMultiSelect
                      selected={brands}
                      onChange={setBrands}
                      placeholder="All brands — narrow by brand…"
                      dark
                    />
                    <p className="text-xs text-white/60 italic mt-1.5">
                      {brands.length
                        ? `Scored against ${brands.length} selected brand${brands.length !== 1 ? "s" : ""}.`
                        : "Leave empty to search all brands."}
                    </p>
                  </div>
                )}
              </div>
            </label>

            {/* Profile Group */}
            <label
              className={`flex items-start gap-3 flex-1 cursor-pointer rounded-xl border p-3.5
                          transition-colors duration-150
                          ${target === "group"
                            ? "border-gold bg-gold/10"
                            : "border-white/20 hover:border-white/40"}`}
            >
              <input
                type="radio"
                name="target"
                value="group"
                checked={target === "group"}
                onChange={() => setTarget("group")}
                className="mt-0.5 accent-red-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Profile Group</p>
                <p className="text-xs text-white/60 mt-0.5">
                  Compare against your custom fragrance profiles
                </p>

                {target === "group" && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    {groups.length === 0 ? (
                      <p className="text-xs text-white/60 italic">
                        No groups yet.{" "}
                        <a
                          href="/profiles"
                          className="underline underline-offset-2 text-white/80 hover:text-white"
                        >
                          Create one in My Profiles →
                        </a>
                      </p>
                    ) : (
                      <>
                        <select
                          value={groupId}
                          onChange={(e) => setGroupId(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-white/25 bg-brand-900
                                     text-sm text-white focus:outline-none focus:border-gold
                                     focus:ring-1 focus:ring-gold transition-colors duration-150"
                        >
                          <option value="">Select a group…</option>
                          {groups.map((g) => (
                            <option key={g.id} value={String(g.id)}>
                              {g.name} ({g.profile_count} profile{g.profile_count !== 1 ? "s" : ""})
                            </option>
                          ))}
                        </select>
                        {selectedGroup?.description && (
                          <p className="text-xs text-white/60 italic mt-1">
                            {selectedGroup.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="submit"
            disabled={isLoading || totalSelected === 0 || (target === "group" && !groupId)}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full
                       bg-brand-900 text-white font-semibold text-sm tracking-wide
                       shadow-sm hover:bg-brand-800 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150 focus-visible:ring-2
                       focus-visible:ring-gold focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Comparing…
              </>
            ) : (
              <>Compare Fragrances <span aria-hidden>→</span></>
            )}
          </button>

          {(totalSelected > 0 || results !== null) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-white/70 hover:text-white underline
                         underline-offset-2 transition-colors duration-150"
            >
              Clear all
            </button>
          )}
        </div>
      </form>

      {/* ── Results ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4
                        text-sm text-red-700 text-center animate-fade-in">
          {error}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="text-center text-white/70 py-10 animate-fade-in">
          <p className="font-serif text-xl mb-2">No meaningful matches found.</p>
          <p className="text-sm">
            {target === "group"
              ? "The selected group has no profiles, or none share any notes with your selection."
              : "Try adding more notes or notes from a wider range of categories."}
          </p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <section className="flex flex-col gap-6 animate-fade-in">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-2xl font-bold text-white">
              Your Closest Matches
            </h2>
            <span className="text-sm text-white/50">
              {target === "group" && selectedGroup
                ? `from "${selectedGroup.name}" group`
                : brands.length
                  ? `from ${brands.length} selected brand${brands.length !== 1 ? "s" : ""}`
                  : "from 31,818 perfumes"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {results.map((result, i) => (
              <ResultCard key={result.perfume_id} result={result} rank={i + 1} noteNames={noteNames} />
            ))}
          </div>

          <p className="text-xs text-center text-white/40 mt-2">
            Scores computed using weighted Jaccard similarity on note composition.
            Rare notes are weighted more heavily.
          </p>
        </section>
      )}

      {!isLoading && results === null && !error && (
        <div className="flex flex-col items-center gap-3 py-10 text-white/50 animate-fade-in">
          <svg className="w-12 h-12 opacity-30" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="24" cy="24" r="20" />
            <path d="M24 14v10l6 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 34c1.5-3 4.5-5 8-5s6.5 2 8 5" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-center max-w-xs">
            Select notes above and click <strong>Compare Fragrances</strong> to discover your closest matches.
          </p>
        </div>
      )}
      </div>
    </main>
  );
}
