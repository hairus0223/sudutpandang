import { API_BASE_URL } from "@/lib/env";
import type { AiTheme, AiGenerateResponse, AiThemesResponse } from "@/lib/imageTypes";

export async function fetchAiThemes(): Promise<AiThemesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai-themes`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "ai_themes_failed");
  }
  return res.json();
}

export async function requestAiGenerate(params: {
  user: string;
  imageId: string;
}): Promise<AiGenerateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ai-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error || "ai_generate_failed");
  }

  return body;
}

export async function setSessionTheme(
  user: string,
  themeId: string
): Promise<{
  success: boolean;
  aiThemeId: string;
  aiThemeLabel: string;
  aiThemeLocked: boolean;
}> {
  const res = await fetch(`${API_BASE_URL}/api/ai-theme/${encodeURIComponent(user)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ themeId }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || "ai_theme_failed");
  }
  return body;
}

export async function fetchAiStatus(params: {
  user: string;
  imageId: string;
  themeId?: string;
  jobId?: string;
}): Promise<AiGenerateResponse> {
  const query = new URLSearchParams();
  if (params.themeId) query.set("themeId", params.themeId);
  if (params.jobId) query.set("jobId", params.jobId);

  const res = await fetch(
    `${API_BASE_URL}/api/images/${encodeURIComponent(params.user)}/${encodeURIComponent(params.imageId)}/ai-status?${query}`,
    { cache: "no-store" }
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || "ai_status_failed");
  }
  return body;
}

export function getThemeById(themes: AiTheme[], themeId: string): AiTheme | undefined {
  return themes.find((theme) => theme.id === themeId);
}
