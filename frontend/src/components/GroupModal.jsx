import { useEffect, useRef, useState } from "react";
import { createGroup, updateGroup } from "../api/profiles";

/**
 * Overlay modal for creating or editing a ProfileGroup.
 *
 * @param {{
 *   onCreated: (group) => void,
 *   onClose: () => void,
 *   initialGroup?: { id: number, name: string, description: string } | null
 * }} props
 */
export default function GroupModal({ onCreated, onClose, initialGroup = null }) {
  const isEdit = Boolean(initialGroup);

  const [name, setName]        = useState(initialGroup?.name        ?? "");
  const [description, setDesc] = useState(initialGroup?.description ?? "");
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState(null);
  const nameRef                = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description: description.trim() };
      const group   = isEdit
        ? await updateGroup(initialGroup.id, payload)
        : await createGroup(payload);
      onCreated(group);
    } catch (err) {
      const msg =
        err?.body?.name?.[0] ??
        err?.body?.detail ??
        `Could not ${isEdit ? "update" : "create"} group.`;
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card-neon rounded-2xl w-full max-w-sm mx-4 p-6 animate-fade-in">
        <h2 className="font-serif text-lg font-bold text-brand-950 mb-4">
          {isEdit ? "Edit group" : "Create a new group"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
              Group name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand X Collection"
              required
              className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                         focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                         transition-colors duration-150"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-brand-900 uppercase tracking-wide">
              Description{" "}
              <span className="text-brand-700/50 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Short note about this group…"
              className="px-3 py-2 rounded-lg border border-brand-200 text-sm text-brand-950
                         resize-none focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold
                         transition-colors duration-150"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-brand-700 hover:text-brand-950
                         transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2 rounded-full bg-brand-900 text-white text-sm font-semibold
                         hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed
                         active:scale-95 transition-all duration-150"
            >
              {saving
                ? (isEdit ? "Saving…" : "Creating…")
                : (isEdit ? "Save changes" : "Create group")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
