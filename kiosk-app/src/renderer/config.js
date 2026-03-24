export const DEFAULT_API_BASE = "http://192.168.1.10:4000";

export function getApiBase() {
  if (typeof window !== "undefined" && window.__KIOSK_CONFIG__?.apiBase) {
    return window.__KIOSK_CONFIG__.apiBase;
  }
  return DEFAULT_API_BASE;
}

export const DEFAULT_KIOSK_CONFIG = {
  sessionDurationSeconds: 600,
  captureCountdownSeconds: 3,
};

export async function fetchKioskConfig() {
  try {
    const res = await fetch(`${getApiBase()}/api/kiosk-config`);
    if (!res.ok) return DEFAULT_KIOSK_CONFIG;

    const data = await res.json();

     // ✅ DEBUG DI SINI
     console.log("FETCHED CONFIG FROM API:", data);

    return {
      sessionDurationSeconds:
        data.sessionDurationSeconds ??
        DEFAULT_KIOSK_CONFIG.sessionDurationSeconds,
      captureCountdownSeconds:
        data.captureCountdownSeconds ??
        DEFAULT_KIOSK_CONFIG.captureCountdownSeconds,
    };
  } catch {
    return DEFAULT_KIOSK_CONFIG;
  }
}

