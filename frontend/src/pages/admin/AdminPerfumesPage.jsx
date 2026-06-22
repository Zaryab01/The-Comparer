import { useEffect, useRef, useState } from "react";
import {
  createPerfume,
  deletePerfume,
  getAdminPerfume,
  updatePerfume,
} from "../../api/admin";
import { searchPerfumes } from "../../api/perfumes";
import NoteSelect from "../../components/NoteSelect";

const EMPTY = { top: [], middle: [], base: [] };

const LAYER_META = [
  { key: "top",    label: "Top Notes",    hint: "Light, volatile opening notes" },
  { key: "middle", label: "Middle Notes", hint: "The heart, after the top fades" },
  { key: "base",   label: "Base Notes",   hint: "The lasting foundation" },
];

export default function AdminPerfumesPage() {
  const [editingId, setEditingId] = useState(null);   // null → create mode
  const [name, setName]           = useState("");
  const [brand, setBrand]         = useState("");
  const [concentration, setConc]  = useState("");
  const [url, setUrl]             = useState("");
  const [notes, setNotes]         = useState(EMPTY);

  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState(null);   // {type, text}

  // Search-to-edit
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try { setResults(await searchPerfumes(q)); setOpen(true); } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function resetForm() {
    setEditingId(null); setName(""); setBrand(""); setConc(""); setUrl(""); setNotes(EMPTY);
  }

  async function loadForEdit(perfumeId) {
    setOpen(false); setQuery(""); setResults([]); setMessage(null);
    try {
      const p = await getAdminPerfume(perfumeId);
      setEditingId(p.perfume_id);
      setName(p.name ?? "");
      setBrand(p.brand ?? "");
      setConc(p.concentration ?? "");
      setUrl(p.url ?? "");
      setNotes({
        top:    p.notes_by_layer?.top    ?? [],
        middle: p.notes_by_layer?.middle ?? [],
        base:   p.notes_by_layer?.base   ?? [],
      });
    } catch {
      setMessage({ type: "error", text: "Could not load that perfume." });
    }
  }

  function addNote(layer) {
    return (note) =>
      setNotes((p) => ({
        ...p,
        [layer]: p[layer].some((n) => n.note_id === note.note_id) ? p[layer] : [...p[layer], note],
      }));
  }
  function removeNote(layer) {
    return (note_id) => setNotes((p) => ({ ...p, [layer]: p[layer].filter((n) => n.note_id !== note_id) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const total = notes.top.length + notes.middle.length + notes.base.length;
    if (total === 0) { setMessage({ type: "error", text: "Add at least one note." }); return; }

    const notes_input = [
      ...notes.top.map((n)    => ({ note_id: n.note_id, layer: "top" })),
      ...notes.middle.map((n) => ({ note_id: n.note_id, layer: "middle" })),
      ...notes.base.map((n)   => ({ note_id: n.note_id, layer: "base" })),
    ];
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      concentration: concentration.trim() || null,
      url: url.trim() || null,
      notes_input,
    };

    setSaving(true); setMessage(null);
    try {
      if (editingId) {
        await updatePerfume(editingId, payload);
        setMessage({ type: "ok", text: `Saved "${payload.name}".` });
      } else {
        const created = await createPerfume(payload);
        setEditingId(created.perfume_id);
        setMessage({ type: "ok", text: `Created "${payload.name}".` });
      }
    } catch (err) {
      const body = err?.body ?? {};
      setMessage({
        type: "error",
        text: body.detail ?? body.notes_input?.[0] ?? body.name?.[0] ?? "Could not save. Check the fields.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deletePerfume(editingId);
      setMessage({ type: "ok", text: `Deleted "${name}".` });
      resetForm();
    } catch {
      setMessage({ type: "error", text: "Could not delete." });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950 " +
    "focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors duration-150";

  return (
    <div className="flex flex-col gap-6">
      {/* Search to edit */}
      <div ref={searchRef} className="relative rounded-2xl card-neon p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
            Edit an existing perfume
          </span>
          <button type="button" onClick={resetForm}
            className="text-xs font-semibold text-gold hover:underline">
            + Add new perfume
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search by name or brand…"
          className={inputCls}
        />
        {open && results.length > 0 && (
          <ul className="absolute left-4 right-4 top-full mt-1 z-30 dropdown-dark
                         rounded-xl max-h-60 overflow-y-auto">
            {results.map((p) => (
              <li key={p.perfume_id}>
                <button type="button" onClick={() => loadForEdit(p.perfume_id)}
                  className="w-full text-left px-4 py-2.5 dropdown-item flex justify-between gap-3
                             border-b border-white/10 last:border-0">
                  <span className="text-sm text-white truncate">{p.name}</span>
                  <span className="text-xs text-white/50 shrink-0">{p.brand}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="rounded-2xl card-neon p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-brand-100 pb-2">
            <h3 className="font-serif text-base font-semibold text-brand-950">
              {editingId ? "Edit perfume" : "New perfume"}
            </h3>
            {editingId && <span className="text-xs text-brand-700/50">{editingId}</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
                Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="e.g. Aventus" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Brand</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Creed" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Concentration</label>
              <input type="text" value={concentration} onChange={(e) => setConc(e.target.value)}
                placeholder="e.g. EDP" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">Source URL</label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…" className={inputCls} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl card-neon p-6 flex flex-col gap-5">
          <h3 className="font-serif text-base font-semibold text-brand-950 border-b border-brand-100 pb-2">
            Notes <span className="text-red-500 text-xs font-normal">* at least one</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {LAYER_META.map(({ key, label, hint }) => (
              <NoteSelect key={key} label={label} hint={hint}
                selectedNotes={notes[key]} onAdd={addNote(key)} onRemove={removeNote(key)} dark />
            ))}
          </div>
        </section>

        {message && (
          <div className={`rounded-xl border px-5 py-3 text-sm ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {editingId ? (
            <button type="button" onClick={handleDelete} disabled={saving}
              className="text-sm text-red-600 hover:text-red-800 underline underline-offset-2 disabled:opacity-40">
              Delete perfume
            </button>
          ) : <span />}
          <button type="submit" disabled={saving}
            className="px-8 py-3 rounded-full bg-brand-900 text-white font-semibold text-sm
                       hover:bg-brand-800 active:scale-95 disabled:opacity-40 transition-all duration-150">
            {saving ? "Saving…" : editingId ? "Save changes" : "Create perfume"}
          </button>
        </div>
      </form>
    </div>
  );
}
