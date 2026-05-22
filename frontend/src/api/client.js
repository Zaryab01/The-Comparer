const BASE = "/api";

export class ApiError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch (_) { /* ignore */ }
    throw new ApiError(res.status, body);
  }

  return res.json();
}
