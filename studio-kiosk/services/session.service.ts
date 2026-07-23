import { API_BASE_URL } from "@/lib/env";
import type { PackageType } from "@/lib/packageTypes";

export type { PackageType };

export type Session = {
  user: string;
  peopleCount: number;
  endsAt: number;
  pausedAt: number | null;
  remainingMs: number | null;
  packageType?: PackageType;
  phase?: string | null;
};

export type SessionState = {
  activeSession: Session | null;
  sessionLocked: boolean;
};

export type KioskStartResponse = {
  success: boolean;
  endsAt: number;
};

export type KioskConfig = {
  sessionDurationMinutes: number;
  captureCountdownSeconds: number;
  trialDurationSeconds: number;
  packageDurations: Record<PackageType, number>;
  packages?: PackageType[];
  aiSelfPhoto?: {
    enabled: boolean;
    openaiConfigured?: boolean;
    defaultDurationMinutes?: number;
  };
};

export type AiQuotaResponse = {
  user: string;
  packageType: PackageType;
  peopleCount: number;
  aiGenerateLimit: number;
  aiGenerateUsed: number;
  aiGenerateRemaining: number;
  aiEnabled: boolean;
};

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(`request_failed:${url}`);

  return res.json() as Promise<T>;
}

export async function getSession(): Promise<SessionState> {
  const res = await fetch(`${API_BASE_URL}/api/session`, { cache: "no-store" });
  if (!res.ok) throw new Error("session_get_failed");
  return res.json();
}

export async function startSession(payload: {
  user: string;
  peopleCount: number;
  duration: number;
  packageType?: PackageType;
}): Promise<Session> {
  const data = await postJson<{ session: Session }>(
    `${API_BASE_URL}/api/session/start`,
    payload
  );
  return data.session;
}

export async function stopSession(): Promise<void> {
  await postJson(`${API_BASE_URL}/api/session/stop`);
}

export async function pauseSession(): Promise<void> {
  await postJson(`${API_BASE_URL}/api/session/pause`);
}

export async function resumeSession(): Promise<Session> {
  const data = await postJson<{ session: Session }>(
    `${API_BASE_URL}/api/session/resume`
  );
  return data.session;
}

export async function addTime(minutes = 1): Promise<void> {
  await postJson(`${API_BASE_URL}/api/session/add-time`, { minutes });
}

export async function trialStart(
  user: string,
  durationSeconds = 60
): Promise<KioskStartResponse> {
  return postJson<KioskStartResponse>(`${API_BASE_URL}/api/kiosk/trial-start`, {
    user,
    durationSeconds,
  });
}

export async function trialSkip(user: string): Promise<void> {
  await postJson(`${API_BASE_URL}/api/kiosk/trial-skip`, { user });
}

export async function mainStart(
  user: string,
  durationSeconds: number,
  packageType: PackageType = "self-photo"
): Promise<KioskStartResponse> {
  return postJson<KioskStartResponse>(`${API_BASE_URL}/api/kiosk/main-start`, {
    user,
    durationSeconds,
    packageType,
  });
}

const DEFAULT_PACKAGE_DURATIONS: Record<PackageType, number> = {
  "self-photo": 10,
  "ai-self-photo": 12,
};

export async function getKioskConfig(): Promise<KioskConfig> {
  const res = await fetch(`${API_BASE_URL}/api/kiosk-config`, { cache: "no-store" });
  if (!res.ok) throw new Error("kiosk_config_failed");
  const data = (await res.json()) as Partial<KioskConfig>;
  return {
    sessionDurationMinutes: data.sessionDurationMinutes ?? 10,
    captureCountdownSeconds: data.captureCountdownSeconds ?? 3,
    trialDurationSeconds: data.trialDurationSeconds ?? 60,
    packageDurations: {
      "self-photo":
        data.packageDurations?.["self-photo"] ??
        data.sessionDurationMinutes ??
        DEFAULT_PACKAGE_DURATIONS["self-photo"],
      "ai-self-photo":
        data.packageDurations?.["ai-self-photo"] ??
        DEFAULT_PACKAGE_DURATIONS["ai-self-photo"],
    },
    packages: data.packages,
    aiSelfPhoto: data.aiSelfPhoto,
  };
}

export function getPackageDurationMinutes(
  packageType: PackageType,
  packageDurations: Record<PackageType, number>
): number {
  return (
    packageDurations[packageType] ??
    DEFAULT_PACKAGE_DURATIONS[packageType] ??
    DEFAULT_PACKAGE_DURATIONS["self-photo"]
  );
}

export async function fetchAiQuota(user: string): Promise<AiQuotaResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai-quota/${encodeURIComponent(user)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("ai_quota_failed");
  return res.json() as Promise<AiQuotaResponse>;
}

export async function triggerKioskCapture(user: string): Promise<void> {
  await postJson(`${API_BASE_URL}/api/kiosk/trigger-capture`, { user });
}
