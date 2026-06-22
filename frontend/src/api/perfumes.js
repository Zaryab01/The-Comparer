import { apiFetch } from "./client";

/**
 * Search perfumes by name or brand.
 * Returns [{perfume_id, name, brand}, …] capped at 10.
 * @param {string} q
 */
export function searchPerfumes(q) {
  const qs = new URLSearchParams({ q });
  return apiFetch(`/perfumes/?${qs}`);
}

/**
 * Fetch full perfume detail including notes grouped by layer.
 * Returns {perfume_id, name, brand, url, notes: {top, middle, base}}
 * @param {string} perfumeId
 */
export function getPerfume(perfumeId) {
  return apiFetch(`/perfumes/${encodeURIComponent(perfumeId)}/`);
}
