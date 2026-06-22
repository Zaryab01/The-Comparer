import { apiFetch } from "./client";

/**
 * List brands with perfume counts, ranked by count.
 * With `q` it searches brand names (for the multi-select); without it returns
 * the top brands. Returns [{name, perfume_count}, …] capped server-side.
 * @param {string} [q]
 */
export function listBrands(q = "") {
  const qs = q ? `?${new URLSearchParams({ q })}` : "";
  return apiFetch(`/brands/${qs}`);
}

/**
 * Fetch perfumes grouped by brand.
 * @param {string[]} brands  brand names; empty → server default (top brands)
 * @param {number} page      per-brand page (PER_BRAND_PAGE_SIZE each)
 * Returns { page, page_size, groups: [{ brand, total, has_more, perfumes: [...] }] }
 */
export function getCatalog(brands = [], page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (brands.length) params.set("brands", brands.join(","));
  return apiFetch(`/catalog/?${params}`);
}
