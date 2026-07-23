import fs from "fs";
import path from "path";
import url from "url";
import {
  buildThemeAssetDirMap,
  getThemeCategoryAssetsDir,
  getThemeCategoryDef,
  listThemeCategoryDefs,
} from "./themeCategories.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @typedef {'world-cup-2026' | 'classic' | 'ai-self-photo'} ThemeCategory */

/**
 * @typedef {object} ThemePreset
 * @property {string} id
 * @property {string} label
 * @property {ThemeCategory} category
 * @property {string} prompt
 * @property {{ from: string, to: string, angle?: number }} gradient
 * @property {string} previewGradient
 * @property {string | null} [assetFilename]
 */

export const WC2026_THEMES_DIR =
  getThemeCategoryAssetsDir("world-cup-2026") ??
  path.join(__dirname, "..", "assets", "themes", "world-cup-2026");

export const CLASSIC_THEMES_DIR =
  getThemeCategoryAssetsDir("classic") ??
  path.join(__dirname, "..", "assets", "themes", "classic");

/** @type {Record<string, string>} */
export const THEME_ASSET_DIRS = buildThemeAssetDirMap();

/** @type {ThemePreset[]} */
export const THEME_PRESETS = [
  {
    id: "wc2026-stadium-night",
    label: "Stadion Malam",
    category: "world-cup-2026",
    prompt:
      "FIFA World Cup 2026 stadium at night, floodlights, green pitch, cinematic portrait background, USA Mexico Canada",
    gradient: { from: "#020617", to: "#166534", angle: 180 },
    previewGradient: "linear-gradient(180deg, #020617, #166534)",
    assetFilename: "wc2026-stadium-night.png",
  },
  {
    id: "wc2026-celebration",
    label: "Perayaan Gol",
    category: "world-cup-2026",
    prompt:
      "World Cup goal celebration background, confetti, golden lights, festive stadium atmosphere, portrait photo",
    gradient: { from: "#1e1b4b", to: "#b45309", angle: 135 },
    previewGradient: "linear-gradient(135deg, #1e1b4b, #b45309)",
    assetFilename: "wc2026-celebration.png",
  },
  {
    id: "wc2026-indonesia-pride",
    label: "Garuda Pride",
    category: "world-cup-2026",
    prompt:
      "Indonesia red and white patriotic portrait background, Garuda spirit, World Cup 2026 fan pride, soft studio lighting",
    gradient: { from: "#b91c1c", to: "#f8fafc", angle: 180 },
    previewGradient: "linear-gradient(180deg, #b91c1c 50%, #f8fafc 50%)",
    assetFilename: "wc2026-indonesia-pride.png",
  },
  {
    id: "wc2026-victory",
    label: "Victory Pose",
    category: "world-cup-2026",
    prompt:
      "Golden World Cup victory celebration background, trophy glow, warm golden hour, champion portrait backdrop",
    gradient: { from: "#422006", to: "#fbbf24", angle: 120 },
    previewGradient: "linear-gradient(120deg, #422006, #fbbf24)",
    assetFilename: "wc2026-victory.png",
  },
  {
    id: "studio-purple",
    label: "Studio Ungu",
    category: "classic",
    prompt:
      "professional purple studio portrait background, soft lighting, portrait photography backdrop, no people",
    gradient: { from: "#1a0a2e", to: "#7c3aed", angle: 135 },
    previewGradient: "linear-gradient(135deg, #1a0a2e, #7c3aed)",
    assetFilename: "studio-purple.png",
  },
  {
    id: "sunset-beach",
    label: "Pantai Sunset",
    category: "classic",
    prompt:
      "tropical beach sunset background, warm golden hour sky, portrait photography backdrop, no people",
    gradient: { from: "#f97316", to: "#2563eb", angle: 180 },
    previewGradient: "linear-gradient(180deg, #f97316, #2563eb)",
    assetFilename: "sunset-beach.png",
  },
  {
    id: "neon-city",
    label: "Neon City",
    category: "classic",
    prompt:
      "cyberpunk neon city night background, vibrant lights, portrait photography backdrop, no people",
    gradient: { from: "#0f172a", to: "#db2777", angle: 45 },
    previewGradient: "linear-gradient(45deg, #0f172a, #db2777)",
    assetFilename: "neon-city.png",
  },
  {
    id: "nature-forest",
    label: "Hutan",
    category: "classic",
    prompt:
      "lush green forest nature background, soft bokeh, portrait photography backdrop, no people",
    gradient: { from: "#14532d", to: "#4ade80", angle: 160 },
    previewGradient: "linear-gradient(160deg, #14532d, #4ade80)",
    assetFilename: "nature-forest.png",
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    category: "classic",
    prompt:
      "warm golden hour outdoor portrait background, soft sunlight, no people",
    gradient: { from: "#fbbf24", to: "#f43f5e", angle: 120 },
    previewGradient: "linear-gradient(120deg, #fbbf24, #f43f5e)",
    assetFilename: "golden-hour.png",
  },
  {
    id: "wild-west",
    label: "Wild West",
    category: "ai-self-photo",
    prompt:
      "Old West frontier town at golden hour, weathered wooden saloon buildings, dusty ground, warm sunset backlight, cinematic portrait backdrop, no people",
    gradient: { from: "#78350f", to: "#fbbf24", angle: 160 },
    previewGradient: "linear-gradient(160deg, #78350f, #fbbf24)",
    assetFilename: "wild-west.png",
  },
];

const ENV_DEFAULT_THEME_ID = (process.env.DEFAULT_THEME_ID || "").trim();

/**
 * @returns {string}
 */
export function resolveDefaultThemeId() {
  if (ENV_DEFAULT_THEME_ID) {
    const found = THEME_PRESETS.find((p) => p.id === ENV_DEFAULT_THEME_ID);
    if (found) return found.id;
  }

  if (THEME_PRESETS.some((p) => p.id === "wc2026-stadium-night")) {
    return "wc2026-stadium-night";
  }

  return THEME_PRESETS[0].id;
}

export const DEFAULT_THEME_ID = resolveDefaultThemeId();

/**
 * @param {ThemePreset} preset
 * @returns {string | null}
 */
export function getThemeAssetsDir(preset) {
  return (
    getThemeCategoryAssetsDir(preset.category) ??
    THEME_ASSET_DIRS[preset.category] ??
    CLASSIC_THEMES_DIR
  );
}

export function getThemeAssetPath(preset) {
  if (!preset.assetFilename) return null;
  const fullPath = path.join(getThemeAssetsDir(preset), preset.assetFilename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * @param {string | undefined | null} themeId
 * @returns {ThemePreset}
 */
export function getThemePreset(themeId) {
  const found = THEME_PRESETS.find((preset) => preset.id === themeId);
  if (found) return found;

  const fallbackId = resolveDefaultThemeId();
  const fallback = THEME_PRESETS.find((preset) => preset.id === fallbackId);
  return fallback ?? THEME_PRESETS[0];
}

/**
 * @param {string | undefined | null} input
 * @returns {string}
 */
export function normalizeThemeId(input) {
  if (!input) return resolveDefaultThemeId();
  const raw = String(input).trim();
  const found = THEME_PRESETS.find((preset) => preset.id === raw);
  return found ? found.id : resolveDefaultThemeId();
}

/**
 * @returns {Array<{ id: string, label: string, category: ThemeCategory, previewGradient: string, hasAsset: boolean, assetAvailable: boolean }>}
 */
export function listThemesForApi() {
  return THEME_PRESETS.map((preset) => {
    const assetPath = getThemeAssetPath(preset);
    return {
      id: preset.id,
      label: preset.label,
      category: preset.category,
      previewGradient: preset.previewGradient,
      hasAsset: Boolean(preset.assetFilename),
      assetAvailable: Boolean(assetPath),
    };
  });
}

/**
 * @returns {Array<{ id: string, label: string, kind: 'event' | 'permanent', sortOrder: number, pickerCompact: boolean, themeCount: number, assetsReady: boolean, missingCount: number }>}
 */
export function listThemeCategoriesForApi() {
  const themes = listThemesForApi();

  return listThemeCategoryDefs().map((category) => {
    const categoryThemes = themes.filter((theme) => theme.category === category.id);
    const missingCount = categoryThemes.filter((theme) => !theme.assetAvailable).length;

    return {
      id: category.id,
      label: category.label,
      kind: category.kind,
      sortOrder: category.sortOrder,
      pickerCompact: Boolean(category.pickerCompact),
      themeCount: categoryThemes.length,
      assetsReady: missingCount === 0 && categoryThemes.length > 0,
      missingCount,
    };
  });
}

/**
 * @param {string} categoryId
 * @returns {{ missing: string[], dir: string }}
 */
function validateCategoryAssetIds(categoryId) {
  const def = getThemeCategoryDef(categoryId);
  const dir = getThemeCategoryAssetsDir(categoryId) ?? "";
  /** @type {string[]} */
  const missing = [];

  if (!def) {
    return { missing, dir };
  }

  for (const themeId of def.themeIds) {
    const preset = getThemePreset(themeId);
    if (!getThemeAssetPath(preset)) {
      missing.push(themeId);
    }
  }

  return { missing, dir };
}

export function validateWorldCupThemeAssets() {
  return validateCategoryAssetIds("world-cup-2026");
}

export function validateClassicThemeAssets() {
  return validateCategoryAssetIds("classic");
}

export function validateAiSelfPhotoThemeAssets() {
  return validateCategoryAssetIds("ai-self-photo");
}

export function validateAllBundledThemeAssets() {
  const categories = listThemeCategoryDefs().map((category) => {
    const result = validateCategoryAssetIds(category.id);
    return {
      categoryId: category.id,
      label: category.label,
      kind: category.kind,
      ...result,
      assetsReady: result.missing.length === 0,
    };
  });

  const wc = categories.find((c) => c.categoryId === "world-cup-2026");
  const classic = categories.find((c) => c.categoryId === "classic");

  return {
    missing: categories.flatMap((category) => category.missing),
    wc2026: wc ? { missing: wc.missing, dir: wc.dir } : { missing: [], dir: "" },
    classic: classic
      ? { missing: classic.missing, dir: classic.dir }
      : { missing: [], dir: "" },
    categories,
  };
}
