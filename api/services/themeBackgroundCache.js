import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export const THEME_CACHE_DIR = path.resolve(
  process.env.THEME_API_CACHE_DIR ||
    path.join(__dirname, "..", "assets", "themes", "cache")
);

export const THEME_CACHE_ENABLED = process.env.THEME_API_CACHE_ENABLED !== "false";

/**
 * @param {string} themeId
 * @param {number} width
 * @param {number} height
 */
export function getThemeCacheFilePath(themeId, width, height) {
  const safeId = String(themeId).replace(/[^a-z0-9_-]/gi, "_");
  return path.join(THEME_CACHE_DIR, `${safeId}-${width}x${height}.png`);
}

/**
 * @param {string} themeId
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Buffer | null>}
 */
export async function readThemeBackgroundCache(themeId, width, height) {
  if (!THEME_CACHE_ENABLED) return null;

  const filePath = getThemeCacheFilePath(themeId, width, height);
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size < 64) return null;
    return fs.promises.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * @param {string} themeId
 * @param {number} width
 * @param {number} height
 * @param {Buffer} buffer
 */
export async function writeThemeBackgroundCache(themeId, width, height, buffer) {
  if (!THEME_CACHE_ENABLED || !buffer?.length) return null;

  await fs.promises.mkdir(THEME_CACHE_DIR, { recursive: true });
  const filePath = getThemeCacheFilePath(themeId, width, height);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

/**
 * @returns {{ enabled: boolean, dir: string, fileCount: number }}
 */
export function getThemeCacheStatus() {
  let fileCount = 0;

  try {
    if (fs.existsSync(THEME_CACHE_DIR)) {
      fileCount = fs
        .readdirSync(THEME_CACHE_DIR)
        .filter((name) => name.endsWith(".png")).length;
    }
  } catch {
    fileCount = 0;
  }

  return {
    enabled: THEME_CACHE_ENABLED,
    dir: THEME_CACHE_DIR,
    fileCount,
  };
}
