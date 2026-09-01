import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { getActiveAiThemeMap } from "./aiThemeCatalog.js";
import { buildThemePreviewPublicUrl } from "./aiThemePreviews.js";
import { BOOTH_BACKGROUND_THEME_IDS } from "./themeBackgroundSvgs.js";
import { resolveThemeBackground } from "./themeBackgrounds.js";
import { resolveBaseDir } from "./studioPaths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BUNDLED_THEME_BACKGROUNDS_DIR = path.join(
  __dirname,
  "..",
  "assets",
  "theme-backgrounds"
);

const BG_BASENAMES = ["bg", "background"];
const BG_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/**
 * @param {string} dir
 * @param {string} basename
 * @returns {string | null}
 */
function findBackgroundFile(dir, basename) {
  if (!fs.existsSync(dir)) return null;

  for (const ext of BG_EXTENSIONS) {
    const candidate = path.join(dir, `${basename}${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Studio override: {BASE_DIR}/themes/{themeId}/bg.jpg
 * @param {string} themeId
 * @param {string} baseDir
 * @returns {string | null}
 */
export function getStudioBackgroundPath(themeId, baseDir = resolveBaseDir()) {
  const studioDir = path.join(baseDir, "themes", themeId);

  for (const basename of BG_BASENAMES) {
    const found = findBackgroundFile(studioDir, basename);
    if (found) return found;
  }

  return null;
}

/**
 * Bundled portrait photo: api/assets/theme-backgrounds/{themeId}/bg.jpg
 * @param {string} themeId
 * @returns {string | null}
 */
export function getBundledPhotoBackgroundPath(themeId) {
  const dir = path.join(BUNDLED_THEME_BACKGROUNDS_DIR, themeId);

  for (const basename of BG_BASENAMES) {
    const found = findBackgroundFile(dir, basename);
    if (found) return found;
  }

  return null;
}

/**
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @returns {string}
 */
export function getBackgroundThemeId(theme) {
  return theme.backgroundThemeId || theme.id;
}

/**
 * @param {string} filePath
 * @returns {Promise<Buffer>}
 */
async function loadBackgroundFile(filePath, width, height) {
  return sharp(filePath)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

/**
 * Resolve composite background for an AI Self Photo theme.
 * Priority: studio bg → bundled portrait photo → SVG/gradient asset fallback.
 * @param {{ aiThemeId: string, width: number, height: number, baseDir?: string, requirePhoto?: boolean }} params
 * @returns {Promise<{ buffer: Buffer, source: 'studio' | 'photo' | 'asset' | 'cache' | 'api' | 'gradient', backgroundThemeId: string }>}
 */
export async function resolveAiThemeBackground({
  aiThemeId,
  width,
  height,
  baseDir = resolveBaseDir(),
  requirePhoto = false,
}) {
  const theme = getActiveAiThemeMap(baseDir).get(aiThemeId) ?? null;
  if (!theme) {
    throw new Error("invalid_theme");
  }

  const backgroundThemeId = getBackgroundThemeId(theme);
  const studioPath = getStudioBackgroundPath(backgroundThemeId, baseDir);

  if (studioPath) {
    const buffer = await loadBackgroundFile(studioPath, width, height);
    return { buffer, source: "studio", backgroundThemeId };
  }

  const bundledPhotoPath = getBundledPhotoBackgroundPath(backgroundThemeId);
  if (bundledPhotoPath) {
    const buffer = await loadBackgroundFile(bundledPhotoPath, width, height);
    return { buffer, source: "photo", backgroundThemeId };
  }

  if (requirePhoto) {
    throw new Error("background_not_found");
  }

  const resolved = await resolveThemeBackground({
    themeId: backgroundThemeId,
    width,
    height,
  });

  return {
    buffer: resolved.buffer,
    source: resolved.source,
    backgroundThemeId,
  };
}

/**
 * @param {string} aiThemeId
 * @param {string} [baseDir]
 * @param {string} [host]
 * @returns {{ backgroundUrl: string | null, backgroundSource: 'studio' | 'photo' | 'svg' | null, backgroundThemeId: string | null }}
 */
export function resolveAiThemeBackgroundPublicUrl(
  aiThemeId,
  baseDir = resolveBaseDir(),
  host = "localhost:4000"
) {
  const theme = getActiveAiThemeMap(baseDir).get(aiThemeId) ?? null;
  if (!theme) {
    return {
      backgroundUrl: null,
      backgroundSource: null,
      backgroundThemeId: null,
    };
  }

  const backgroundThemeId = getBackgroundThemeId(theme);
  const studioPath = getStudioBackgroundPath(backgroundThemeId, baseDir);

  if (studioPath) {
    const ext = path.extname(studioPath);
    const basename = path.basename(studioPath, ext);
    return {
      backgroundUrl: buildThemePreviewPublicUrl(
        host,
        `/themes/${backgroundThemeId}/${basename}${ext}`
      ),
      backgroundSource: "studio",
      backgroundThemeId,
    };
  }

  const bundledPhotoPath = getBundledPhotoBackgroundPath(backgroundThemeId);
  if (bundledPhotoPath) {
    const ext = path.extname(bundledPhotoPath);
    return {
      backgroundUrl: buildThemePreviewPublicUrl(
        host,
        `/theme-backgrounds/${backgroundThemeId}/bg${ext}`
      ),
      backgroundSource: "photo",
      backgroundThemeId,
    };
  }

  return {
    backgroundUrl: buildThemePreviewPublicUrl(
      host,
      `/theme-assets/ai-self-photo/${backgroundThemeId}.png`
    ),
    backgroundSource: "svg",
    backgroundThemeId,
  };
}

/**
 * @returns {{ ok: boolean, missing: string[], themeIds: string[] }}
 */
export function validateBundledThemeBackgrounds() {
  const missing = BOOTH_BACKGROUND_THEME_IDS.filter(
    (themeId) => !getBundledPhotoBackgroundPath(themeId)
  );

  return {
    ok: missing.length === 0,
    missing,
    themeIds: [...BOOTH_BACKGROUND_THEME_IDS],
  };
}
