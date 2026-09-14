import { API_BASE_URL } from "@/lib/env";

export type ThemePrintTune = {
  hairHaloKill: number;
  hairFeather: number;
  edgeBgBlend: number;
  focalLengthMm: number;
  aperture: number;
  backdropDistanceM: number;
  autoFocus: boolean;
  alphaFeather: number;
  lightWrap: number;
  colorMatch: number;
  warmth: number;
  cinematicFinish: boolean;
  cinematicIntensity: number;
  contactShadow: boolean;
  harmonize: boolean;
  lookBake: boolean;
};

export type ThemePrintTuneField = {
  key: keyof ThemePrintTune;
  label: string;
  hint: string;
  min?: number;
  max?: number;
  step?: number;
  kind: "range" | "toggle";
  group?: string;
};

export type ThemePrintPreset = {
  id: string;
  label: string;
  hint: string;
  values: ThemePrintTune;
};

export type ThemePrintTuneTheme = {
  id: string;
  label: string;
};

export type ThemePrintTuneResponse = {
  ok: boolean;
  themeId?: string | null;
  tune: ThemePrintTune;
  defaults: ThemePrintTune;
  presets: ThemePrintPreset[];
  fields: ThemePrintTuneField[];
  persistPath: string;
  themes?: ThemePrintTuneTheme[];
  reprocess?: { imageId: string } | null;
};

export async function fetchThemePrintTune(
  themeId?: string | null
): Promise<ThemePrintTuneResponse> {
  const query = themeId ? `?themeId=${encodeURIComponent(themeId)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/theme-print-tune${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("tune_fetch_failed");
  return res.json();
}

export async function saveThemePrintTune(
  tune: ThemePrintTune,
  options: { user?: string; imageId?: string; themeId?: string | null } = {}
): Promise<ThemePrintTuneResponse> {
  const res = await fetch(`${API_BASE_URL}/api/theme-print-tune`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tune,
      user: options.user,
      imageId: options.imageId,
      themeId: options.themeId || undefined,
    }),
  });
  if (!res.ok) throw new Error("tune_save_failed");
  return res.json();
}

export async function applyThemePrintPreset(
  presetId: string,
  options: { user?: string; imageId?: string; themeId?: string | null } = {}
): Promise<ThemePrintTuneResponse> {
  const res = await fetch(`${API_BASE_URL}/api/theme-print-tune`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      presetId,
      user: options.user,
      imageId: options.imageId,
      themeId: options.themeId || undefined,
    }),
  });
  if (!res.ok) throw new Error("tune_preset_failed");
  return res.json();
}
