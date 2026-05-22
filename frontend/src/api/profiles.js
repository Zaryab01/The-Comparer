import { apiFetch } from "./client";

// ── Groups ────────────────────────────────────────────────────────────────────

export function listGroups() {
  return apiFetch("/groups/");
}

export function createGroup(data) {
  return apiFetch("/groups/", { method: "POST", body: JSON.stringify(data) });
}

export function updateGroup(id, data) {
  return apiFetch(`/groups/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteGroup(id) {
  return apiFetch(`/groups/${id}/`, { method: "DELETE" });
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export function listProfiles(groupId = null) {
  const qs = groupId ? `?group=${groupId}` : "";
  return apiFetch(`/profiles/${qs}`);
}

export function getProfile(id) {
  return apiFetch(`/profiles/${id}/`);
}

export function createProfile(data) {
  return apiFetch("/profiles/", { method: "POST", body: JSON.stringify(data) });
}

export function updateProfile(id, data) {
  return apiFetch(`/profiles/${id}/`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteProfile(id) {
  return apiFetch(`/profiles/${id}/`, { method: "DELETE" });
}
