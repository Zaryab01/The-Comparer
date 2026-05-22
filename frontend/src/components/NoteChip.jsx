/**
 * A selected-note chip with a remove button.
 * @param {{ label: string, onRemove: () => void }} props
 */
export default function NoteChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                     bg-brand-100 border border-brand-200 text-brand-900
                     text-xs font-medium tracking-wide animate-fade-in">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="ml-0.5 rounded-full w-4 h-4 flex items-center justify-center
                   text-brand-700 hover:bg-brand-200 hover:text-brand-950
                   transition-colors duration-150 focus-visible:outline-none"
      >
        ×
      </button>
    </span>
  );
}
