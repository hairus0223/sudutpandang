import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveBaseDir } from "./studioPaths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {string} */
export const BUNDLED_THEME_PREVIEWS_DIR = path.join(
  __dirname,
  "..",
  "assets",
  "ai-theme-previews"
);

const PREVIEW_BASENAMES = ["after", "before"];
const PREVIEW_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/**
 * @param {string} dir
 * @param {string} basename
 * @returns {string | null}
 */
function findPreviewFile(dir, basename) {
  if (!fs.existsSync(dir)) return null;

  for (const ext of PREVIEW_EXTENSIONS) {
    const candidate = path.join(dir, `${basename}${ext}`);
    if (fs.existsSync(candidate)) {
      return `${basename}${ext}`;
    }
  }

  return null;
}

/**
 * @param {string} themeId
 * @param {string} baseDir
 * @returns {{ dir: string, urlPrefix: string } | null}
 */
function resolveStudioPreviewLocation(themeId, baseDir) {
  const studioDir = path.join(baseDir || resolveBaseDir(), "themes", themeId);
  const afterFile = findPreviewFile(studioDir, "after");
  if (afterFile) {
    return {
      dir: studioDir,
      urlPrefix: `/themes/${themeId}`,
    };
  }
  return null;
}

/**
 * @param {string} themeId
 * @returns {{ dir: string, urlPrefix: string } | null}
 */
function resolveBundledPreviewLocation(themeId) {
  const bundledDir = path.join(BUNDLED_THEME_PREVIEWS_DIR, themeId);
  const afterFile = findPreviewFile(bundledDir, "after");
  if (afterFile) {
    return {
      dir: bundledDir,
      urlPrefix: `/theme-previews/${themeId}`,
    };
  }
  return null;
}

/**
 * @param {string | null | undefined} host
 * @param {string} urlPath
 * @returns {string}
 */
export function buildThemePreviewPublicUrl(host, urlPath) {
  const normalizedHost = String(host || "localhost:4000").replace(/\/+$/, "");
  const normalizedPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  return `http://${normalizedHost}${normalizedPath}`;
}

/**
 * @param {string} themeId
 * @param {string} [baseDir]
 * @param {string} [host]
 * @returns {{ afterUrl: string | null, beforeUrl: string | null, source: "studio" | "bundled" | null }}
 */
export function resolveThemePreviewUrls(themeId, baseDir, host) {
  const location =
    resolveStudioPreviewLocation(themeId, baseDir) ??
    resolveBundledPreviewLocation(themeId);

  if (!location) {
    return { afterUrl: null, beforeUrl: null, source: null };
  }

  const afterFile = findPreviewFile(location.dir, "after");
  const beforeFile = findPreviewFile(location.dir, "before");

  const source = location.urlPrefix.startsWith("/themes/")
    ? "studio"
    : "bundled";

  return {
    afterUrl: afterFile
      ? buildThemePreviewPublicUrl(host, `${location.urlPrefix}/${afterFile}`)
      : null,
    beforeUrl: beforeFile
      ? buildThemePreviewPublicUrl(host, `${location.urlPrefix}/${beforeFile}`)
      : null,
    source,
  };
}

/**
 * @param {string} themeId
 * @param {string} [baseDir]
 * @returns {boolean}
 */
export function themeHasPreviewAsset(themeId, baseDir) {
  const previews = resolveThemePreviewUrls(themeId, baseDir, "localhost");
  return Boolean(previews.afterUrl);
}
