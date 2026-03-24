import { getApiBase } from "../config";

const API_BASE = getApiBase();

export async function registerCustomer(payload) {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("register_failed");
  const data = await res.json();
  return data.customer;
}

export async function startSession({ userSlug, peopleCount, durationMinutes }) {
  const res = await fetch(`${API_BASE}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userSlug, peopleCount, duration: durationMinutes }),
  });
  if (!res.ok) throw new Error("session_start_failed");
  const data = await res.json();
  return data.session;
}

export async function stopSession() {
  await fetch(`${API_BASE}/api/session/stop`, { method: "POST" });
}

export async function fetchLatestImage(userSlug) {
  const res = await fetch(`${API_BASE}/api/images/${encodeURIComponent(userSlug)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data.images) || data.images.length === 0) return null;
  return data.images[data.images.length - 1];
}

// Optional backend-triggered capture hook (e.g. to call camera SDK/CLI)
export async function triggerBackendCapture(userSlug) {
  const res = await fetch(`${API_BASE}/api/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userSlug }),
  });
  if (!res.ok) throw new Error("capture_failed");
  return res.json();
}

