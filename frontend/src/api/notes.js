import { apiFetch } from "./client";

/**
 * Autocomplete search — returns [{note_id, name}, …] capped at 20.
 * @param {string} q
 * @returns {Promise<Array<{note_id: string, name: string}>>}
 */
export function searchNotes(q) {
  const qs = new URLSearchParams({ q });
  return apiFetch(`/notes/?${qs}`);
}
