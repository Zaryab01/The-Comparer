import { ApiError } from "./client";

const TOKEN_KEY = "admin_token";
const USER_KEY  = "admin_username";

function authHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Token ${t}` } : {};
}

/** Fetch helper that injects the admin token and clears it on 401. */
async function adminFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...options.headers },
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new ApiError(res.status, body);
  }
  return res.status === 204 ? null : res.json();
}

// ── Auth ──
export function adminLogin(username, password) {
  return adminFetch("/admin/login/", { method: "POST", body: JSON.stringify({ username, password }) });
}
export function adminLogout() {
  return adminFetch("/admin/logout/", { method: "POST" });
}
export function adminMe() {
  return adminFetch("/admin/me/");
}

// ── Perfumes ──
export function createPerfume(payload) {
  return adminFetch("/admin/perfumes/", { method: "POST", body: JSON.stringify(payload) });
}
export function getAdminPerfume(perfumeId) {
  return adminFetch(`/admin/perfumes/${encodeURIComponent(perfumeId)}/`);
}
export function updatePerfume(perfumeId, payload) {
  return adminFetch(`/admin/perfumes/${encodeURIComponent(perfumeId)}/`, {
    method: "PUT", body: JSON.stringify(payload),
  });
}
export function deletePerfume(perfumeId) {
  return adminFetch(`/admin/perfumes/${encodeURIComponent(perfumeId)}/`, { method: "DELETE" });
}

// ── Notes & aliases ──
export function createNote(name) {
  return adminFetch("/admin/notes/", { method: "POST", body: JSON.stringify({ name }) });
}
export function listAliases(noteId) {
  const qs = noteId ? `?${new URLSearchParams({ note_id: noteId })}` : "";
  return adminFetch(`/admin/aliases/${qs}`);
}
export function createAlias(aliasName, noteId) {
  return adminFetch("/admin/aliases/", {
    method: "POST", body: JSON.stringify({ alias_name: aliasName, note_id: noteId }),
  });
}

// ── Logs ──
export function listLogs(page = 1) {
  return adminFetch(`/admin/logs/?${new URLSearchParams({ page: String(page) })}`);
}
