export const DEFAULT_API_BASE = "http://192.168.1.10:4000";

export function getApiBase() {
  if (typeof window !== "undefined" && window.__KIOSK_CONFIG__?.apiBase) {
    return window.__KIOSK_CONFIG__.apiBase;
  }
  return DEFAULT_API_BASE;
}

/** Shape consumed by App.jsx (useSessionTimer + capture countdown). */
export const DEFAULT_KIOSK_CONFIG = {
  sessionDurationMinutes: 10,
  captureCountdownSeconds: 3,
};

function resolveSessionDurationMinutes(data) {
  if (
    data.sessionDurationMinutes != null &&
    !Number.isNaN(Number(data.sessionDurationMinutes))
  ) {
    return Number(data.sessionDurationMinutes);
  }

  if (
    data.sessionDurationSeconds != null &&
    !Number.isNaN(Number(data.sessionDurationSeconds))
  ) {
    return Math.round(Number(data.sessionDurationSeconds) / 60);
  }

  return DEFAULT_KIOSK_CONFIG.sessionDurationMinutes;
}

export async function fetchKioskConfig() {
  try {
    const res = await fetch(`${getApiBase()}/api/kiosk-config`);
    if (!res.ok) return DEFAULT_KIOSK_CONFIG;

    const data = await res.json();

    return {
      sessionDurationMinutes: resolveSessionDurationMinutes(data),
      captureCountdownSeconds:
        data.captureCountdownSeconds ??
        DEFAULT_KIOSK_CONFIG.captureCountdownSeconds,
    };
  } catch {
    return DEFAULT_KIOSK_CONFIG;
  }
}
