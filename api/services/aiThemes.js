import { resolveThemePreviewUrls } from "./aiThemePreviews.js";
import { resolveAiThemeBackgroundPublicUrl } from "./aiThemeBackgrounds.js";
import {
  BUNDLED_AI_THEMES,
  getActiveAiThemes,
  getActiveAiThemeMap,
} from "./aiThemeCatalog.js";
import { resolveBaseDir } from "./studioPaths.js";

/** @typedef {import("./aiThemeCatalog.js").AiTheme} AiTheme */

export { BUNDLED_AI_THEMES as AI_THEMES };

/**
 * @param {string | undefined | null} themeId
 * @param {string} [baseDir]
 * @returns {AiTheme | null}
 */
export function getAiTheme(themeId, baseDir = resolveBaseDir()) {
  if (!themeId) return null;
  const id = String(themeId).trim();
  return getActiveAiThemeMap(baseDir).get(id) ?? null;
}

/**
 * @param {string | undefined | null} themeId
 * @param {string} [baseDir]
 * @returns {string}
 */
export function normalizeAiThemeId(themeId, baseDir = resolveBaseDir()) {
  const theme = getAiTheme(themeId, baseDir);
  if (theme) return theme.id;
  const fallback = getActiveAiThemes(baseDir)[0] ?? BUNDLED_AI_THEMES[0];
  return fallback.id;
}

/**
 * @param {string} [baseDir]
 * @returns {AiTheme[]}
 */
export function listAiThemes(baseDir = resolveBaseDir()) {
  return getActiveAiThemes(baseDir).map((theme) => ({ ...theme }));
}

/**
 * @param {AiTheme} theme
 * @returns {string}
 */
export function getThemeTransformPrompt(theme) {
  return theme.transformPrompt;
}

/**
 * @param {AiTheme} theme
 * @param {string} [baseDir]
 * @param {string} [host]
 */
export function toPublicAiTheme(theme, baseDir = resolveBaseDir(), host = "localhost:4000") {
  const previews = resolveThemePreviewUrls(theme.id, baseDir, host);
  const background = resolveAiThemeBackgroundPublicUrl(theme.id, baseDir, host);

  return {
    id: theme.id,
    label: theme.label,
    description: theme.description,
    previewColor: theme.previewColor,
    type: "transform",
    previewUrl: previews.afterUrl,
    ...(previews.beforeUrl ? { previewBeforeUrl: previews.beforeUrl } : {}),
    ...(previews.source ? { previewSource: previews.source } : {}),
    ...(background.backgroundUrl
      ? {
          backgroundUrl: background.backgroundUrl,
          backgroundSource: background.backgroundSource,
          backgroundThemeId: background.backgroundThemeId,
        }
      : {}),
  };
}

/**
 * Public theme list for API (no internal prompt fields).
 * @param {string} [baseDir]
 * @param {string} [host]
 */
export function listAiThemesPublic(baseDir = resolveBaseDir(), host = "localhost:4000") {
  return getActiveAiThemes(baseDir).map((theme) =>
    toPublicAiTheme(theme, baseDir, host)
  );
}

/**
 * @param {string} jobId
 * @returns {{ imageId: string, themeId: string } | null}
 */
export function parseAiJobId(jobId) {
  if (!jobId || typeof jobId !== "string") return null;
  const sep = jobId.indexOf("__");
  if (sep <= 0 || sep >= jobId.length - 2) return null;
  return {
    imageId: jobId.slice(0, sep),
    themeId: jobId.slice(sep + 2),
  };
}

/**
 * @param {string} imageId
 * @param {string} themeId
 * @returns {string}
 */
export function buildAiJobId(imageId, themeId) {
  return `${imageId}__${themeId}`;
}
