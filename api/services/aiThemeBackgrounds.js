import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getActiveAiThemeMap } from "./aiThemeCatalog.js";
import { buildThemePreviewPublicUrl } from "./aiThemePreviews.js";
import { resolveThemeBackground } from "./themeBackgrounds.js";
import { resolveBaseDir } from "./studioPaths.js";

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
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @returns {string}
 */
export function getBackgroundThemeId(theme) {
  return theme.backgroundThemeId || theme.id;
}

/**
 * Resolve composite background for an AI Self Photo theme.
 * Priority: studio bg file → bundled theme asset → gradient fallback.
 * @param {{ aiThemeId: string, width: number, height: number, baseDir?: string }} params
 * @returns {Promise<{ buffer: Buffer, source: 'studio' | 'asset' | 'cache' | 'api' | 'gradient', backgroundThemeId: string }>}
 */
export async function resolveAiThemeBackground({
  aiThemeId,
  width,
  height,
  baseDir = resolveBaseDir(),
}) {
  const theme = getActiveAiThemeMap(baseDir).get(aiThemeId) ?? null;
  if (!theme) {
    throw new Error("invalid_theme");
  }

  const backgroundThemeId = getBackgroundThemeId(theme);
  const studioPath = getStudioBackgroundPath(backgroundThemeId, baseDir);

  if (studioPath) {
    const buffer = await sharp(studioPath)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();

    return { buffer, source: "studio", backgroundThemeId };
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
 * @returns {{ backgroundUrl: string | null, backgroundSource: 'studio' | 'bundled' | null, backgroundThemeId: string | null }}
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

  return {
    backgroundUrl: buildThemePreviewPublicUrl(
      host,
      `/theme-assets/ai-self-photo/${backgroundThemeId}.png`
    ),
    backgroundSource: "bundled",
    backgroundThemeId,
  };
}
