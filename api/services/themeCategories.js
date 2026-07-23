import path from "path";
import url from "url";
import { CLASSIC_THEME_IDS, WC2026_THEME_IDS, AI_SELF_PHOTO_THEME_IDS } from "./themeAssetSvgs.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const THEMES_ROOT = path.join(__dirname, "..", "assets", "themes");

/** @typedef {'event' | 'permanent'} ThemeCategoryKind */

/**
 * @typedef {object} ThemeCategoryDef
 * @property {string} id
 * @property {string} label
 * @property {ThemeCategoryKind} kind
 * @property {string} assetsSubdir
 * @property {string[]} themeIds
 * @property {number} sortOrder
 * @property {boolean} [pickerCompact]
 */

/**
 * Registry for bundled theme categories. To add a new event:
 * 1. Add SVG templates + THEME_IDS in themeAssetSvgs.js
 * 2. Add presets in themePresets.js (same category id)
 * 3. Append entry here with assetsSubdir folder name
 * 4. Run: npm run generate:theme-assets -- --category <id>
 * @type {ThemeCategoryDef[]}
 */
export const THEME_CATEGORY_REGISTRY = [
  {
    id: "world-cup-2026",
    label: "Piala Dunia 2026",
    kind: "event",
    assetsSubdir: "world-cup-2026",
    themeIds: WC2026_THEME_IDS,
    sortOrder: 10,
    pickerCompact: false,
  },
  {
    id: "classic",
    label: "Tema Klasik",
    kind: "permanent",
    assetsSubdir: "classic",
    themeIds: CLASSIC_THEME_IDS,
    sortOrder: 20,
    pickerCompact: true,
  },
  {
    id: "ai-self-photo",
    label: "AI Self Photo",
    kind: "permanent",
    assetsSubdir: "ai-self-photo",
    themeIds: AI_SELF_PHOTO_THEME_IDS,
    sortOrder: 30,
    pickerCompact: true,
  },
];

/**
 * @param {string} categoryId
 * @returns {ThemeCategoryDef | undefined}
 */
export function getThemeCategoryDef(categoryId) {
  return THEME_CATEGORY_REGISTRY.find((entry) => entry.id === categoryId);
}

/**
 * @param {string} categoryId
 * @returns {string | null}
 */
export function getThemeCategoryAssetsDir(categoryId) {
  const def = getThemeCategoryDef(categoryId);
  if (!def) return null;
  return path.join(THEMES_ROOT, def.assetsSubdir);
}

/**
 * @returns {Record<string, string>}
 */
export function buildThemeAssetDirMap() {
  /** @type {Record<string, string>} */
  const map = {};

  for (const category of THEME_CATEGORY_REGISTRY) {
    map[category.id] = path.join(THEMES_ROOT, category.assetsSubdir);
  }

  return map;
}

/**
 * @returns {ThemeCategoryDef[]}
 */
export function listThemeCategoryDefs() {
  return [...THEME_CATEGORY_REGISTRY].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

/**
 * @param {ThemeCategoryKind} [kind]
 * @returns {ThemeCategoryDef[]}
 */
export function listThemeCategoryDefsByKind(kind) {
  if (!kind) return listThemeCategoryDefs();
  return listThemeCategoryDefs().filter((entry) => entry.kind === kind);
}
