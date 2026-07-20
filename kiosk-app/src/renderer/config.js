export const DEFAULT_API_BASE = "http://localhost:4000";

export function getApiBase() {
  if (typeof window !== "undefined") {
    const configuredBase =
      window.kiosk?.config?.apiBase || window.__KIOSK_CONFIG__?.apiBase;
    if (configuredBase) return configuredBase.replace(/\/+$/, "");
  }
  return DEFAULT_API_BASE;
}

const DEFAULT_PACKAGE_DURATIONS = {
  "self-photo": 10,
  "pas-photo": 5,
  "ai-photo": 10,
};

/** Shape consumed by App.jsx (defaults/warnings; live timer comes from Socket). */
export const DEFAULT_KIOSK_CONFIG = {
  sessionDurationMinutes: 10,
  captureCountdownSeconds: 3,
  trialDurationSeconds: 60,
  packageDurations: DEFAULT_PACKAGE_DURATIONS,
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

function resolveTrialDurationSeconds(data) {
  if (
    data.trialDurationSeconds != null &&
    !Number.isNaN(Number(data.trialDurationSeconds))
  ) {
    return Number(data.trialDurationSeconds);
  }

  return DEFAULT_KIOSK_CONFIG.trialDurationSeconds;
}

function resolvePackageDurations(data) {
  const fromApi = data.packageDurations;
  if (!fromApi || typeof fromApi !== "object") {
    return DEFAULT_KIOSK_CONFIG.packageDurations;
  }

  return {
    "self-photo":
      Number(fromApi["self-photo"]) || DEFAULT_PACKAGE_DURATIONS["self-photo"],
    "pas-photo":
      Number(fromApi["pas-photo"]) || DEFAULT_PACKAGE_DURATIONS["pas-photo"],
    "ai-photo":
      Number(fromApi["ai-photo"]) || DEFAULT_PACKAGE_DURATIONS["ai-photo"],
  };
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
      trialDurationSeconds: resolveTrialDurationSeconds(data),
      packageDurations: resolvePackageDurations(data),
    };
  } catch {
    return DEFAULT_KIOSK_CONFIG;
  }
}
