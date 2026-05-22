import { useEffect, useRef, useState } from "react";
import { searchNotes } from "../api/notes";
import NoteChip from "./NoteChip";

const DEBOUNCE_MS = 250;

/**
 * Multi-note autocomplete input for one fragrance layer.
 *
 * @param {{
 *   label: string,
 *   hint?: string,
 *   selectedNotes: Array<{note_id: string, name: string}>,
 *   onAdd: (note: {note_id: string, name: string}) => void,
 *   onRemove: (note_id: string) => void,
 * }} props
 */
export default function NoteSelect({ label, hint, selectedNotes, onAdd, onRemove }) {
  const [query, setQuery]             = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);
  const [loading, setLoading]         = useState(false);

  const inputRef      = useRef(null);
  const containerRef  = useRef(null);
  const debounceRef   = useRef(null);
  // Keep selected ids in a ref so the debounced callback always reads the latest
  const selectedIdsRef = useRef(new Set());
  selectedIdsRef.current = new Set(selectedNotes.map((n) => n.note_id));

  // ── Debounced autocomplete: only [query] is a dep — avoids infinite loops ──
  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions((prev) => (prev.length === 0 ? prev : []));
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchNotes(query);
        const filtered = results.filter((n) => !selectedIdsRef.current.has(n.note_id));
        setSuggestions(filtered);
        setOpen(filtered.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]); // ← query only; selectedIdsRef is a ref (stable)

  // ── Close on click outside ──
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectNote(note) {
    if (!selectedIdsRef.current.has(note.note_id)) onAdd(note);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
        if (!open) break;
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        if (!open) break;
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (open && activeIdx >= 0 && suggestions[activeIdx]) {
          selectNote(suggestions[activeIdx]);
        }
        break;
      case "Escape":
        setOpen(false);
        setActiveIdx(-1);
        break;
      case "Backspace":
        if (!query && selectedNotes.length > 0) {
          onRemove(selectedNotes[selectedNotes.length - 1].note_id);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div>
        <span className="block font-serif text-sm font-semibold text-brand-900 tracking-wide uppercase">
          {label}
        </span>
        {hint && (
          <span className="block text-xs text-brand-700 mt-0.5 italic">{hint}</span>
        )}
      </div>

      {/* Selected chips */}
      {selectedNotes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedNotes.map((note) => (
            <NoteChip
              key={note.note_id}
              label={note.name}
              onRemove={() => onRemove(note.note_id)}
            />
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                        border border-brand-200 bg-white
                        focus-within:border-gold focus-within:ring-1 focus-within:ring-gold
                        transition-colors duration-150">
          {loading && (
            <span className="w-3 h-3 border-2 border-brand-200 border-t-gold
                             rounded-full animate-spin shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={
              selectedNotes.length === 0
                ? `Search ${label.toLowerCase()} notes…`
                : "Add more…"
            }
            className="flex-1 bg-transparent text-sm text-brand-950
                       placeholder-brand-700/50 outline-none min-w-0"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Suggestions dropdown */}
        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-lg border border-brand-200
                       bg-white shadow-lg overflow-auto max-h-56 no-scrollbar
                       animate-fade-in"
          >
            {suggestions.map((note, idx) => (
              <li
                key={note.note_id}
                role="option"
                aria-selected={idx === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); selectNote(note); }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100
                            ${idx === activeIdx
                              ? "bg-brand-100 text-brand-950 font-medium"
                              : "text-brand-800 hover:bg-brand-50"}`}
              >
                {note.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
