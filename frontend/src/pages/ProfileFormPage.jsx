import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listGroups } from "../api/profiles";
import {
  createProfile,
  getProfile,
  updateProfile,
} from "../api/profiles";
import GroupModal from "../components/GroupModal";
import NoteSelect from "../components/NoteSelect";

const EMPTY_NOTES = { top: [], middle: [], base: [] };

function notesInputFromProfile(profile) {
  const items = [];
  for (const layer of ["top", "middle", "base"]) {
    for (const n of profile.notes_by_layer?.[layer] ?? []) {
      items.push({ note_id: n.note_id, layer });
    }
  }
  return items;
}

export default function ProfileFormPage() {
  const { id }     = useParams();          // present when editing
  const navigate   = useNavigate();
  const isEdit     = Boolean(id);

  // Form fields
  const [name, setName]       = useState("");
  const [brand, setBrand]     = useState("");
  const [link, setLink]       = useState("");
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes]     = useState(EMPTY_NOTES);   // {top,middle,base} → [{note_id,name}]

  // Supporting state
  const [groups, setGroups]         = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [loading, setLoading]       = useState(isEdit);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  // Load groups
  useEffect(() => {
    listGroups().then(setGroups).catch(() => {});
  }, []);

  // Load profile when editing
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    getProfile(id)
      .then((p) => {
        setName(p.name);
        setBrand(p.brand);
        setLink(p.link ?? "");
        setGroupId(String(p.group?.id ?? ""));
        setNotes({
          top:    p.notes_by_layer?.top    ?? [],
          middle: p.notes_by_layer?.middle ?? [],
          base:   p.notes_by_layer?.base   ?? [],
        });
      })
      .catch(() => setError("Could not load profile."))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // ── Note helpers ────────────────────────────────────────────────────────────
  function addNote(layer) {
    return (note) =>
      setNotes((prev) => ({
        ...prev,
        [layer]: prev[layer].some((n) => n.note_id === note.note_id)
          ? prev[layer]
          : [...prev[layer], note],
      }));
  }

  function removeNote(layer) {
    return (note_id) =>
      setNotes((prev) => ({
        ...prev,
        [layer]: prev[layer].filter((n) => n.note_id !== note_id),
      }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    const totalNotes = notes.top.length + notes.middle.length + notes.base.length;
    if (totalNotes === 0) {
      setError("Add at least one note to this profile.");
      return;
    }
    if (!groupId) {
      setError("Please select or create a group.");
      return;
    }

    const notesInput = [
      ...notes.top.map((n)    => ({ note_id: n.note_id, layer: "top" })),
      ...notes.middle.map((n) => ({ note_id: n.note_id, layer: "middle" })),
      ...notes.base.map((n)   => ({ note_id: n.note_id, layer: "base" })),
    ];

    const payload = {
      name:         name.trim(),
      brand:        brand.trim(),
      link:         link.trim() || null,
      group_id:     Number(groupId),
      notes_input:  notesInput,
    };

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateProfile(id, payload);
      } else {
        await createProfile(payload);
      }
      navigate("/profiles");
    } catch (err) {
      const body = err?.body ?? {};
      const msg  =
        body?.detail ??
        body?.name?.[0] ??
        body?.brand?.[0] ??
        body?.notes_input?.[0] ??
        "Could not save profile. Check all fields and try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Group created callback ──────────────────────────────────────────────────
  function onGroupCreated(newGroup) {
    setGroups((prev) => [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name)));
    setGroupId(String(newGroup.id));
    setShowModal(false);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <span className="w-8 h-8 border-4 border-brand-200 border-t-gold rounded-full animate-spin" />
      </main>
    );
  }

  const LAYER_META = [
    { key: "top",    label: "Top Notes",    hint: "First impression — light, volatile notes perceived in the first 15 min" },
    { key: "middle", label: "Middle Notes", hint: "Heart of the fragrance — emerges after the top fades" },
    { key: "base",   label: "Base Notes",   hint: "The lasting foundation — rich, anchoring notes" },
  ];

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h2 className="font-serif text-3xl font-bold text-white drop-shadow-lg">
          {isEdit ? "Edit Profile" : "New Profile"}
        </h2>
        <p className="text-white/70 mt-1 text-sm drop-shadow">
          {isEdit
            ? "Update the fragrance profile's notes or details."
            : "Add a custom fragrance profile to compare against your main database or other groups."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* ── Identity ── */}
        <section className="rounded-2xl card-neon p-6 flex flex-col gap-5">
          <h3 className="font-serif text-base font-semibold text-brand-950 border-b border-brand-100 pb-2">
            Fragrance Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
                Fragrance name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Oud Bouquet"
                className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                           focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                           transition-colors duration-150"
              />
            </div>

            {/* Brand */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
                placeholder="e.g. House of Aromas"
                className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                           focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                           transition-colors duration-150"
              />
            </div>

            {/* Group */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
                Group <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={groupId}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setShowModal(true);
                    } else {
                      setGroupId(e.target.value);
                    }
                  }}
                  required
                  className="flex-1 px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                             bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                             transition-colors duration-150"
                >
                  <option value="">Select a group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={String(g.id)}>{g.name}</option>
                  ))}
                  <option value="__new__">✦ Create new group…</option>
                </select>
              </div>
              {groupId && groups.find((g) => String(g.id) === groupId)?.description && (
                <p className="text-xs text-brand-700/60 italic mt-0.5">
                  {groups.find((g) => String(g.id) === groupId).description}
                </p>
              )}
            </div>

            {/* Link */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
                Link <span className="text-brand-700/50 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                           focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                           transition-colors duration-150"
              />
            </div>
          </div>
        </section>

        {/* ── Notes ── */}
        <section className="rounded-2xl card-neon p-6 flex flex-col gap-5">
          <h3 className="font-serif text-base font-semibold text-brand-950 border-b border-brand-100 pb-2">
            Fragrance Composition <span className="text-red-500 text-xs font-sans font-normal">* at least one note required</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {LAYER_META.map(({ key, label, hint }) => (
              <NoteSelect
                key={key}
                label={label}
                hint={hint}
                selectedNotes={notes[key]}
                onAdd={addNote(key)}
                onRemove={removeNote(key)}
                dark
              />
            ))}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 justify-end">
          <button
            type="button"
            onClick={() => navigate("/profiles")}
            className="text-sm text-white/70 hover:text-white underline underline-offset-2
                       transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 rounded-full bg-brand-900 text-white font-semibold text-sm
                       tracking-wide shadow-sm hover:bg-brand-800 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150 focus-visible:ring-2 focus-visible:ring-gold"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create profile"}
          </button>
        </div>
      </form>

      {/* Group creation modal */}
      {showModal && (
        <GroupModal
          onCreated={onGroupCreated}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  );
}
