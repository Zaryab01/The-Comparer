import { apiFetch } from "./client";

/**
 * Compare a custom fragrance against the database.
 *
 * @param {string[]} top    - note_id list for top notes
 * @param {string[]} middle - note_id list for middle notes
 * @param {string[]} base   - note_id list for base notes
 * @returns {Promise<{results: MatchResult[]}>}
 *
 * @typedef {Object} LayerBreakdown
 * @property {number} score
 * @property {string[]} matched_note_ids
 *
 * @typedef {Object} MatchResult
 * @property {string}  perfume_id
 * @property {string}  perfume_name
 * @property {string|null} perfume_brand
 * @property {number|null} release_year
 * @property {string|null} url
 * @property {number}  overall_score
 * @property {LayerBreakdown|null} top
 * @property {LayerBreakdown|null} middle
 * @property {LayerBreakdown|null} base
 */
/**
 * @param {string[]} top
 * @param {string[]} middle
 * @param {string[]} base
 * @param {{ target?: "main"|"group", group_id?: number }} [extra={}]
 */
export function compareFragrance(top, middle, base, extra = {}) {
  return apiFetch("/compare/", {
    method: "POST",
    body: JSON.stringify({ top, middle, base, ...extra }),
  });
}
