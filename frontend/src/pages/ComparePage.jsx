import { useEffect, useState } from "react";
import { compareFragrance } from "../api/compare";
import { ApiError } from "../api/client";
import { listGroups, listProfiles } from "../api/profiles";
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

  // "Load from profile" selector
  const [profiles,          setProfiles]          = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  // Target selection
  const [target,  setTarget]  = useState("main"); // "main" | "group"
  const [groupId, setGroupId] = useState("");
  const [groups,  setGroups]  = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [results,   setResults]   = useState(null);
  const [error,     setError]     = useState(null);

  const totalSelected = topNotes.length + middleNotes.length + baseNotes.length;

  const noteNames = Object.fromEntries(
    [...topNotes, ...middleNotes, ...baseNotes].map((n) => [n.note_id, n.name])
  );

  // Load groups and profiles for selectors
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

  // ── Load from profile ───────────────────────────────────────────────────────
  function handleProfileSelect(e) {
    const pid = e.target.value;
    setSelectedProfileId(pid);
    if (!pid) return;
    const p = profiles.find((pr) => String(pr.id) === pid);
    if (!p) return;
    setTopNotes(p.notes_by_layer?.top       ?? []);
    setMiddleNotes(p.notes_by_layer?.middle ?? []);
    setBaseNotes(p.notes_by_layer?.base     ?? []);
    // Scroll the user's attention to the note panels
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
      const extra = target === "group" ? { target: "group", group_id: Number(groupId) } : {};
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
    setResults(null); setError(null);
  }

  const selectedGroup   = groups.find((g) => String(g.id) === groupId);
  const selectedProfile = profiles.find((p) => String(p.id) === selectedProfileId);

  // Group profiles by group for the optgroup select
  const profilesByGroupId = groups.reduce((acc, g) => {
    acc[g.id] = profiles.filter((p) => p.group?.id === g.id);
    return acc;
  }, {});
  // Profiles not belonging to any listed group (edge case)
  const ungroupedProfiles = profiles.filter(
    (p) => !groups.some((g) => g.id === p.group?.id)
  );

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-12">

      {/* Hero */}
      <section className="text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brand-950 leading-tight mb-3">
          Build your fragrance,<br className="hidden sm:block" /> find your match.
        </h2>
        <p className="text-brand-700 max-w-xl mx-auto leading-relaxed">
          Select the notes you love — or the notes of a fragrance you're trying to
          recreate — and we'll find the closest real perfumes in our database.
        </p>
      </section>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">

        {/* ── Load from saved profile (shown only if profiles exist) ── */}
        {profiles.length > 0 && (
          <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
                Start from a saved profile
              </span>
              <span className="text-xs text-brand-700/50">
                — pre-fills the note panels below
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedProfileId}
                onChange={handleProfileSelect}
                className="flex-1 px-3 py-2 rounded-lg border border-brand-200 bg-white
                           text-sm text-brand-950 focus:outline-none focus:border-gold
                           focus:ring-1 focus:ring-gold transition-colors duration-150"
              >
                <option value="">Select a profile…</option>

                {/* Profiles grouped by group name */}
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

                {/* Ungrouped profiles fallback */}
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
                  className="text-brand-700/50 hover:text-brand-950 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}
            </div>

            {selectedProfile && (
              <p className="text-xs text-brand-700/50 italic">
                Notes pre-filled from &ldquo;{selectedProfile.name}&rdquo; by {selectedProfile.brand}.
                You can still edit them below.
              </p>
            )}
          </div>
        )}

        {/* Note selectors */}
        <div id="note-panels" className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { key: "top",    notes: topNotes,    setter: setTopNotes    },
            { key: "middle", notes: middleNotes, setter: setMiddleNotes },
            { key: "base",   notes: baseNotes,   setter: setBaseNotes   },
          ].map(({ key, notes, setter }) => (
            <div
              key={key}
              className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm flex flex-col gap-3"
            >
              <NoteSelect
                label={`${key.charAt(0).toUpperCase() + key.slice(1)} Notes`}
                hint={LAYER_HINTS[key]}
                selectedNotes={notes}
                onAdd={addNote(setter)}
                onRemove={removeNote(setter)}
              />
            </div>
          ))}
        </div>

        {/* ── Target selector ── */}
        <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm flex flex-col gap-3">
          <span className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
            Compare against
          </span>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Main DB */}
            <label
              className={`flex items-start gap-3 flex-1 cursor-pointer rounded-xl border p-3.5
                          transition-colors duration-150
                          ${target === "main"
                            ? "border-gold bg-amber-50/60"
                            : "border-brand-200 hover:border-brand-300"}`}
            >
              <input
                type="radio"
                name="target"
                value="main"
                checked={target === "main"}
                onChange={() => setTarget("main")}
                className="mt-0.5 accent-amber-700"
              />
              <div>
                <p className="text-sm font-semibold text-brand-950">Main Database</p>
                <p className="text-xs text-brand-700/60 mt-0.5">
                  31,156 perfumes · full Parfumo catalogue
                </p>
              </div>
            </label>

            {/* Profile Group */}
            <label
              className={`flex items-start gap-3 flex-1 cursor-pointer rounded-xl border p-3.5
                          transition-colors duration-150
                          ${target === "group"
                            ? "border-gold bg-amber-50/60"
                            : "border-brand-200 hover:border-brand-300"}`}
            >
              <input
                type="radio"
                name="target"
                value="group"
                checked={target === "group"}
                onChange={() => setTarget("group")}
                className="mt-0.5 accent-amber-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-950">Profile Group</p>
                <p className="text-xs text-brand-700/60 mt-0.5">
                  Compare against your custom fragrance profiles
                </p>

                {target === "group" && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    {groups.length === 0 ? (
                      <p className="text-xs text-brand-700/50 italic">
                        No groups yet.{" "}
                        <a
                          href="/profiles"
                          className="underline underline-offset-2 text-brand-700 hover:text-brand-950"
                        >
                          Create one in My Profiles →
                        </a>
                      </p>
                    ) : (
                      <>
                        <select
                          value={groupId}
                          onChange={(e) => setGroupId(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-brand-200 bg-white
                                     text-sm text-brand-950 focus:outline-none focus:border-gold
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
                          <p className="text-xs text-brand-700/50 italic mt-1">
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
              className="text-sm text-brand-700 hover:text-brand-950 underline
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
        <div className="text-center text-brand-700/60 py-10 animate-fade-in">
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
            <h2 className="font-serif text-2xl font-bold text-brand-950">
              Your Closest Matches
            </h2>
            <span className="text-sm text-brand-700/50">
              {target === "group" && selectedGroup
                ? `from "${selectedGroup.name}" group`
                : "from 31,156 perfumes"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {results.map((result, i) => (
              <ResultCard key={result.perfume_id} result={result} rank={i + 1} noteNames={noteNames} />
            ))}
          </div>

          <p className="text-xs text-center text-brand-700/40 mt-2">
            Scores computed using weighted Jaccard similarity on note composition.
            Rare notes are weighted more heavily.
          </p>
        </section>
      )}

      {!isLoading && results === null && !error && (
        <div className="flex flex-col items-center gap-3 py-10 text-brand-700/40 animate-fade-in">
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
    </main>
  );
}
