import { getApiBase } from "../config";

const API_BASE = getApiBase();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export function getPreviewUrl(image, packageType = "self-photo") {
  if (!image) return null;

  if (image.processingStatus === "ready") {
    if (packageType === "pas-photo" && image.variants?.passport) {
      return image.variants.passport;
    }

    if (packageType === "ai-photo" && image.variants?.themed) {
      return image.variants.themed;
    }

    if (
      (packageType === "ai-photo" || packageType === "pas-photo") &&
      image.variants?.subject
    ) {
      return image.variants.subject;
    }
  }

  return image.url ?? null;
}

export function isAwaitingProcessedPreview(image, packageType = "self-photo") {
  if (!image) return false;
  if (packageType !== "ai-photo" && packageType !== "pas-photo") return false;

  return (
    image.processingStatus === "pending" ||
    image.processingStatus === "processing"
  );
}

export { getKioskProcessingMessage } from "../lib/processingLabels.js";

export async function fetchLatestImage(userSlug) {
  const res = await fetch(`${API_BASE}/api/images/${encodeURIComponent(userSlug)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data.images) || data.images.length === 0) return null;
  return data.images[data.images.length - 1];
}

export async function fetchImageStatus(userSlug, imageId) {
  const res = await fetch(
    `${API_BASE}/api/images/${encodeURIComponent(userSlug)}/${encodeURIComponent(imageId)}/status`
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * Poll until image reaches ready/failed or timeout.
 * @param {object} params
 * @param {string} params.userSlug
 * @param {string} params.imageId
 * @param {number} [params.intervalMs]
 * @param {number} [params.maxMs]
 * @param {AbortSignal} [params.signal]
 */
export async function pollImageUntilSettled({
  userSlug,
  imageId,
  intervalMs = 2000,
  maxMs = 120000,
  signal,
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxMs) {
    if (signal?.aborted) {
      throw new Error("poll_aborted");
    }

    const status = await fetchImageStatus(userSlug, imageId);
    if (!status) {
      await sleep(intervalMs);
      continue;
    }

    if (status.status === "ready" || status.status === "failed") {
      return status;
    }

    await sleep(intervalMs);
  }

  throw new Error("poll_timeout");
}

export async function refreshLatestPreview(userSlug, packageType) {
  const latest = await fetchLatestImage(userSlug);
  return {
    image: latest,
    previewUrl: getPreviewUrl(latest, packageType),
    isProcessing: isAwaitingProcessedPreview(latest, packageType),
  };
}

export async function triggerBackendCapture(userSlug) {
  const res = await fetch(`${API_BASE}/api/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userSlug }),
  });
  if (!res.ok) throw new Error("capture_failed");
  return res.json();
}

export function applyKioskSyncFields(setters, fields = {}) {
  if (fields.packageType) setters.setPackageType(fields.packageType);
  if (fields.passportSizeId) setters.setPassportSizeId(fields.passportSizeId);
  if (fields.themeId) setters.setThemeId(fields.themeId);
  if (fields.lookId && setters.setLookId) setters.setLookId(fields.lookId);
}

export async function updateKioskLook(userSlug, lookId) {
  const res = await fetch(`${API_BASE}/api/kiosk/look`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userSlug, lookId }),
  });
  if (!res.ok) throw new Error("look_update_failed");
  return res.json();
}
