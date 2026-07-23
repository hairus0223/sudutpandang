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

export function getPreviewUrl(image) {
  if (!image) return null;
  return image.url ?? null;
}

export function isAwaitingProcessedPreview(_image) {
  return false;
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

export async function refreshLatestPreview(userSlug) {
  const latest = await fetchLatestImage(userSlug);
  return {
    image: latest,
    previewUrl: getPreviewUrl(latest),
    isProcessing: isAwaitingProcessedPreview(latest),
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

/**
 * Dev fallback: grab current video frame and POST to API capture/ watcher folder.
 * drawImage uses the raw MediaStream frame (same orientation as live preview — not mirrored).
 * @param {HTMLVideoElement | null | undefined} videoEl
 */
export async function triggerWebcamCapture(videoEl) {
  if (!videoEl?.videoWidth || !videoEl.videoHeight) {
    throw new Error("webcam_not_ready");
  }

  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  // No horizontal flip — saved JPEG must match what the customer sees on screen.
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("webcam_encode_failed"));
      },
      "image/jpeg",
      0.92
    );
  });

  const form = new FormData();
  form.append("file", blob, `webcam-${Date.now()}.jpg`);

  const res = await fetch(`${API_BASE}/api/capture/webcam`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("webcam_capture_failed");
  return res.json();
}

export function applyKioskSyncFields(setters, fields = {}) {
  if (fields.packageType && typeof setters.setPackageType === "function") {
    setters.setPackageType(fields.packageType);
  }
  if (
    fields.aiThemeLabel !== undefined &&
    typeof setters.setAiThemeLabel === "function"
  ) {
    setters.setAiThemeLabel(fields.aiThemeLabel || null);
  }
  if (
    fields.aiThemePreviewUrl !== undefined &&
    typeof setters.setAiThemePreviewUrl === "function"
  ) {
    setters.setAiThemePreviewUrl(fields.aiThemePreviewUrl || null);
  }
  if (
    fields.aiThemePreviewColor !== undefined &&
    typeof setters.setAiThemePreviewColor === "function"
  ) {
    setters.setAiThemePreviewColor(fields.aiThemePreviewColor || null);
  }
  if (
    fields.aiThemeType !== undefined &&
    typeof setters.setAiThemeType === "function"
  ) {
    setters.setAiThemeType(fields.aiThemeType || null);
  }
  if (
    fields.aiGenerateLimit !== undefined &&
    typeof setters.setAiGenerateLimit === "function"
  ) {
    setters.setAiGenerateLimit(Number(fields.aiGenerateLimit) || 0);
  }
}
