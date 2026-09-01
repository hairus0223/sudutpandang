import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { BOOTH_BACKGROUND_THEME_IDS } from "./themeBackgroundSvgs.js";
import { resolveBaseDir } from "./studioPaths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const THEME_PROP_OVERLAYS_ENABLED =
  process.env.THEME_PROP_OVERLAYS_ENABLED !== "false";

export const BUNDLED_THEME_OVERLAYS_DIR = path.join(
  __dirname,
  "..",
  "assets",
  "theme-overlays"
);

const OVERLAY_BASENAMES = ["frame", "overlay", "props"];
const OVERLAY_EXTENSIONS = [".png", ".webp"];

/**
 * @typedef {{
 *   file: string,
 *   blend?: "over" | "multiply" | "screen" | "soft-light",
 *   opacity?: number,
 * }} AiThemeOverlayRef
 */

/**
 * @param {string} dir
 * @param {string} basename
 */
function findOverlayFile(dir, basename) {
  if (!fs.existsSync(dir)) return null;

  for (const ext of OVERLAY_EXTENSIONS) {
    const candidate = path.join(dir, `${basename}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * @param {string} themeId
 * @param {string} [baseDir]
 */
export function getStudioOverlayDir(themeId, baseDir = resolveBaseDir()) {
  return path.join(baseDir, "themes", themeId, "overlays");
}

/**
 * @param {string} themeId
 */
export function getBundledOverlayDir(themeId) {
  return path.join(BUNDLED_THEME_OVERLAYS_DIR, themeId);
}

/**
 * @param {string} themeId
 * @param {string} [baseDir]
 * @returns {string[]}
 */
export function resolveThemeOverlayPaths(themeId, baseDir = resolveBaseDir()) {
  /** @type {string[]} */
  const paths = [];
  const seen = new Set();

  const addFromDir = (dir) => {
    if (!dir) return;
    for (const basename of OVERLAY_BASENAMES) {
      const found = findOverlayFile(dir, basename);
      if (found && !seen.has(found)) {
        seen.add(found);
        paths.push(found);
      }
    }
  };

  addFromDir(getStudioOverlayDir(themeId, baseDir));
  addFromDir(getBundledOverlayDir(themeId));

  return paths;
}

/**
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @param {string} [baseDir]
 */
export function resolveConfiguredOverlayPaths(theme, baseDir = resolveBaseDir()) {
  const refs = Array.isArray(theme.overlays) ? theme.overlays : [];
  /** @type {string[]} */
  const paths = [];

  for (const ref of refs) {
    const file = String(ref?.file ?? "").trim();
    if (!file) continue;

    const studioPath = path.join(getStudioOverlayDir(theme.id, baseDir), file);
    if (fs.existsSync(studioPath)) {
      paths.push(studioPath);
      continue;
    }

    const bundledPath = path.join(getBundledOverlayDir(theme.id), file);
    if (fs.existsSync(bundledPath)) {
      paths.push(bundledPath);
    }
  }

  return paths;
}

/**
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @param {string} [baseDir]
 */
export function listThemeOverlayPaths(theme, baseDir = resolveBaseDir()) {
  const configured = resolveConfiguredOverlayPaths(theme, baseDir);
  if (configured.length > 0) return configured;
  return resolveThemeOverlayPaths(theme.id, baseDir);
}

/**
 * @param {Buffer} input
 * @param {number} opacity
 */
async function applyOverlayOpacity(input, opacity) {
  if (opacity >= 0.999) return input;

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels ?? 4;
  if (channels < 4) return input;

  for (let i = 3; i < data.length; i += channels) {
    data[i] = Math.round(data[i] * opacity);
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels },
  })
    .png()
    .toBuffer();
}

/**
 * Composite prop/frame PNG layers onto a booth result.
 * @param {string | Buffer} inputPathOrBuffer
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @param {number} width
 * @param {number} height
 * @param {string} [baseDir]
 */
export async function applyThemePropOverlays(
  inputPathOrBuffer,
  theme,
  width,
  height,
  baseDir = resolveBaseDir()
) {
  if (!THEME_PROP_OVERLAYS_ENABLED) {
    return typeof inputPathOrBuffer === "string"
      ? fs.promises.readFile(inputPathOrBuffer)
      : inputPathOrBuffer;
  }

  const overlayPaths = listThemeOverlayPaths(theme, baseDir);
  if (overlayPaths.length === 0) {
    return typeof inputPathOrBuffer === "string"
      ? fs.promises.readFile(inputPathOrBuffer)
      : inputPathOrBuffer;
  }

  const refs = Array.isArray(theme.overlays) ? theme.overlays : [];
  /** @type {import('sharp').OverlayOptions[]} */
  const layers = [];

  for (const overlayPath of overlayPaths) {
    const basename = path.basename(overlayPath);
    const ref = refs.find((entry) => String(entry.file) === basename);
    const opacity = Math.max(0, Math.min(1, Number(ref?.opacity ?? 1)));
    const blend = ref?.blend ?? "over";

    let overlayBuffer = await sharp(overlayPath)
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .png()
      .toBuffer();

    overlayBuffer = await applyOverlayOpacity(overlayBuffer, opacity);
    layers.push({ input: overlayBuffer, top: 0, left: 0, blend });
  }

  const base = sharp(inputPathOrBuffer).ensureAlpha();
  return base.composite(layers).png({ compressionLevel: 6, effort: 8 }).toBuffer();
}

/**
 * @returns {{ ok: boolean, themeIds: string[], missing: string[] }}
 */
export function validateBundledThemeOverlays() {
  /** @type {string[]} */
  const missing = [];

  for (const themeId of BOOTH_BACKGROUND_THEME_IDS) {
    const paths = resolveThemeOverlayPaths(themeId, resolveBaseDir());
    if (paths.length === 0) {
      missing.push(themeId);
    }
  }

  return {
    ok: missing.length === 0,
    themeIds: [...BOOTH_BACKGROUND_THEME_IDS],
    missing,
  };
}
