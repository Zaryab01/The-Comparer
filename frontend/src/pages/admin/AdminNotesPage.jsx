import { useEffect, useRef, useState } from "react";
import { createAlias, createNote, listAliases } from "../../api/admin";
import { searchNotes } from "../../api/notes";

const inputCls =
  "px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950 " +
  "focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors duration-150";

export default function AdminNotesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AddNoteCard />
      <AddAliasCard />
    </div>
  );
}

// ── Add canonical note ───────────────────────────────────────────────────────────
function AddNoteCard() {
  const [name, setName]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const note = await createNote(name.trim());
      setMessage({ type: "ok", text: `Created "${note.name}" (${note.note_id}).` });
      setName("");
    } catch (err) {
      setMessage({ type: "error", text: err?.body?.name?.[0] ?? err?.body?.detail ?? "Could not create note." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl card-neon p-6 flex flex-col gap-4">
      <h3 className="font-serif text-base font-semibold text-brand-950 border-b border-brand-100 pb-2">
        Add a canonical note
      </h3>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Note name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Smoked Vetiver" className={inputCls} />
        </div>
        <button type="submit" disabled={busy}
          className="px-6 py-2 rounded-full bg-brand-900 text-white font-semibold text-sm
                     hover:bg-brand-800 active:scale-95 disabled:opacity-40 transition-all duration-150">
          {busy ? "Adding…" : "Add note"}
        </button>
      </form>
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

// ── Add alias → canonical note ───────────────────────────────────────────────────
function AddAliasCard() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [note, setNote]         = useState(null);     // {note_id, name}
  const [aliasName, setAlias]   = useState("");
  const [aliases, setAliases]   = useState([]);
  const [busy, setBusy]         = useState(false);
  const [message, setMessage]   = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try { setResults(await searchNotes(q)); setOpen(true); } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function selectNote(n) {
    setNote(n); setQuery(""); setResults([]); setOpen(false); setMessage(null);
    try { setAliases(await listAliases(n.note_id)); } catch { setAliases([]); }
  }

  async function submit(e) {
    e.preventDefault();
    if (!note) { setMessage({ type: "error", text: "Pick a canonical note first." }); return; }
    setBusy(true); setMessage(null);
    try {
      const created = await createAlias(aliasName.trim(), note.note_id);
      setMessage({ type: "ok", text: `"${created.alias_name}" → ${created.canonical_name}.` });
      setAlias("");
      setAliases((prev) => [...prev, created].sort((a, b) => a.alias_name.localeCompare(b.alias_name)));
    } catch (err) {
      setMessage({ type: "error", text: err?.body?.alias_name?.[0] ?? err?.body?.detail ?? "Could not add alias." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl card-neon p-6 flex flex-col gap-4">
      <h3 className="font-serif text-base font-semibold text-brand-950 border-b border-brand-100 pb-2">
        Add an alias (synonym → canonical note)
      </h3>

      {/* Pick the canonical note */}
      <div ref={searchRef} className="relative flex flex-col gap-1">
        <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Canonical note</label>
        {note ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-900 text-white text-sm px-3 py-1">
              {note.name}
              <button type="button" onClick={() => { setNote(null); setAliases([]); }} className="hover:text-gold">✕</button>
            </span>
          </div>
        ) : (
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search a note to attach the alias to…" className={inputCls} />
        )}
        {open && results.length > 0 && !note && (
          <ul className="absolute left-0 right-0 top-full mt-1 z-30 dropdown-dark
                         rounded-xl max-h-60 overflow-y-auto">
            {results.map((n) => (
              <li key={n.note_id}>
                <button type="button" onClick={() => selectNote(n)}
                  className="w-full text-left px-4 py-2 dropdown-item text-sm text-white/90
                             border-b border-white/10 last:border-0">
                  {n.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Existing aliases for the chosen note */}
      {note && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.length === 0
            ? <span className="text-xs text-brand-700/50 italic">No aliases yet for this note.</span>
            : aliases.map((a) => (
                <span key={a.id} className="inline-block rounded-full bg-brand-50 border border-brand-200
                                            text-[11px] text-brand-800 px-2 py-0.5">
                  {a.alias_name}
                </span>
              ))}
        </div>
      )}

      {/* Alias input */}
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">New alias</label>
          <input type="text" value={aliasName} onChange={(e) => setAlias(e.target.value)} required
            placeholder="e.g. Agarwood" className={inputCls} />
        </div>
        <button type="submit" disabled={busy || !note}
          className="px-6 py-2 rounded-full bg-brand-900 text-white font-semibold text-sm
                     hover:bg-brand-800 active:scale-95 disabled:opacity-40 transition-all duration-150">
          {busy ? "Adding…" : "Add alias"}
        </button>
      </form>
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
