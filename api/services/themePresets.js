/** @typedef {{ id: string, label: string, prompt: string, gradient: { from: string, to: string, angle?: number } }} ThemePreset */

/** @type {ThemePreset[]} */
export const THEME_PRESETS = [
  {
    id: "studio-purple",
    label: "Studio Ungu",
    prompt: "professional purple studio portrait background, soft lighting",
    gradient: { from: "#1a0a2e", to: "#7c3aed", angle: 135 },
  },
  {
    id: "sunset-beach",
    label: "Pantai Sunset",
    prompt: "tropical beach sunset background, warm golden hour sky",
    gradient: { from: "#f97316", to: "#2563eb", angle: 180 },
  },
  {
    id: "neon-city",
    label: "Neon City",
    prompt: "cyberpunk neon city night background, vibrant lights",
    gradient: { from: "#0f172a", to: "#db2777", angle: 45 },
  },
  {
    id: "nature-forest",
    label: "Hutan",
    prompt: "lush green forest nature background, soft bokeh",
    gradient: { from: "#14532d", to: "#4ade80", angle: 160 },
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    prompt: "warm golden hour outdoor portrait background",
    gradient: { from: "#fbbf24", to: "#f43f5e", angle: 120 },
  },
];

export const DEFAULT_THEME_ID = THEME_PRESETS[0].id;

/**
 * @param {string | undefined | null} themeId
 * @returns {ThemePreset}
 */
export function getThemePreset(themeId) {
  const found = THEME_PRESETS.find((preset) => preset.id === themeId);
  return found ?? THEME_PRESETS[0];
}

/**
 * @param {string | undefined | null} input
 * @returns {string}
 */
export function normalizeThemeId(input) {
  if (!input) return DEFAULT_THEME_ID;
  const raw = String(input).trim();
  return getThemePreset(raw).id;
}
