import { useEffect, useRef, useState } from "react";
import { listBrands } from "../api/catalog";

const DEBOUNCE_MS = 250;

/**
 * Searchable, tick-box brand multi-select. Selected brands are tracked by name.
 * Reused by the Catalog page and (later) the Compare brand-scope control.
 *
 * @param {{
 *   selected: string[],
 *   onChange: (brands: string[]) => void,
 *   placeholder?: string,
 * }} props
 */
export default function BrandMultiSelect({ selected, onChange, placeholder = "Search brands…", dark = false }) {
  const [query, setQuery]       = useState("");
  const [options, setOptions]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const containerRef = useRef(null);
  const debounceRef  = useRef(null);

  // Load top brands once on open (empty query), and on each query change.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        setOptions(await listBrands(query.trim()));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(name) {
    onChange(
      selected.includes(name)
        ? selected.filter((b) => b !== name)
        : [...selected, name]
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((name) => (
            <span
              key={name}
              className={`inline-flex items-center gap-1 rounded-full text-white
                         text-xs font-medium pl-3 pr-1.5 py-1 ${dark ? "bg-gold" : "bg-brand-900"}`}
            >
              {name}
              <button
                type="button"
                onClick={() => toggle(name)}
                className="hover:text-gold transition-colors"
                title={`Remove ${name}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className={`text-xs underline underline-offset-2 ${dark ? "text-white/60 hover:text-white" : "text-brand-700/60 hover:text-brand-950"}`}
          >
            Clear
          </button>
        </div>
      )}

      {/* Input */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg
                      focus-within:border-gold focus-within:ring-1 focus-within:ring-gold
                      transition-colors duration-150
                      ${dark ? "border border-white/30 bg-white/5" : "border border-brand-200 bg-white"}`}>
        {loading
          ? <span className={`w-3.5 h-3.5 border-2 rounded-full animate-spin shrink-0 ${dark ? "border-white/20 border-t-white" : "border-brand-200 border-t-gold"}`} />
          : (
            <svg className={`w-4 h-4 shrink-0 ${dark ? "text-white/60" : "text-brand-700/40"}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
          )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${dark ? "text-white placeholder-white/50" : "text-brand-950 placeholder-brand-700/40"}`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg dropdown-dark
                       overflow-auto max-h-64 animate-fade-in">
          {options.length === 0 && !loading && (
            <li className="px-3 py-2.5 text-sm text-brand-700/50 italic">No brands found</li>
          )}
          {options.map((b) => {
            const isSel = selected.includes(b.name);
            return (
              <li key={b.name}>
                <button
                  type="button"
                  onClick={() => toggle(b.name)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm
                             dropdown-item ${isSel ? "is-active" : ""}`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                                ${isSel ? "bg-brand-900 border-brand-900" : "border-brand-300"}`}
                  >
                    {isSel && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 truncate text-brand-900">{b.name}</span>
                  <span className="text-xs text-brand-700/50 shrink-0">{b.perfume_count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
