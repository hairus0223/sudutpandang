import fs from "fs";
import sharp from "sharp";
import { isCompositePipelineMode } from "./aiThemeCatalog.js";
import {
  getBundledPhotoBackgroundPath,
  getStudioBackgroundPath,
} from "./aiThemeBackgrounds.js";
import { resolveThemePreviewUrls } from "./aiThemePreviews.js";

export const MIN_THEME_BACKGROUND_SHORT_EDGE =
  Number(process.env.AI_THEME_BG_MIN_SHORT_EDGE) || 1200;

/**
 * @param {string} themeId
 * @param {string} [baseDir]
 * @returns {string | null}
 */
export function getThemePhotoBackgroundPath(themeId, baseDir) {
  return getStudioBackgroundPath(themeId, baseDir) ?? getBundledPhotoBackgroundPath(themeId);
}

/**
 * @param {string} filePath
 * @returns {Promise<{ width: number, height: number, shortEdge: number }>}
 */
export async function readImageSize(filePath) {
  const meta = await sharp(filePath, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  return { width, height, shortEdge: Math.min(width, height) };
}

/**
 * Production gate for register cards + customer composite (photo assets only).
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @param {string} [baseDir]
 */
export function evaluateThemeProduction(theme, baseDir) {
  /** @type {string[]} */
  const issues = [];
  const previews = resolveThemePreviewUrls(theme.id, baseDir, "localhost");
  const bgPath = getThemePhotoBackgroundPath(theme.backgroundThemeId || theme.id, baseDir);

  if (!isCompositePipelineMode(theme.pipelineMode ?? "direct")) {
    issues.push("pipelineMode not composite");
  }
  if (!theme.lookId) issues.push("lookId missing");
  if (!theme.placement) issues.push("placement missing");
  if (!bgPath) issues.push("photo background missing");
  if (!previews.afterUrl) issues.push("preview after missing");
  if (!previews.beforeUrl) issues.push("preview before missing");

  return {
    ok: issues.length === 0,
    issues,
    hasPhotoBackground: Boolean(bgPath),
    backgroundPath: bgPath,
    hasAfter: Boolean(previews.afterUrl),
    hasBefore: Boolean(previews.beforeUrl),
    pipelineMode: theme.pipelineMode ?? null,
    lookId: theme.lookId ?? null,
    placement: theme.placement ?? null,
  };
}

/**
 * Register-ready: may still wait on before-preview, but never SVG/API fallback.
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @param {string} [baseDir]
 */
export function isThemeSelectableForRegister(theme, baseDir) {
  const report = evaluateThemeProduction(theme, baseDir);
  return (
    isCompositePipelineMode(theme.pipelineMode ?? "direct") &&
    Boolean(theme.lookId) &&
    Boolean(theme.placement) &&
    report.hasPhotoBackground &&
    report.hasAfter
  );
}

/**
 * @param {string} filePath
 */
export async function assertBackgroundMeetsPrintSize(filePath) {
  const { shortEdge } = await readImageSize(filePath);
  if (shortEdge < MIN_THEME_BACKGROUND_SHORT_EDGE) {
    throw new Error("background_too_small");
  }
}
