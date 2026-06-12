import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  getThemeAssetPath,
  getThemePreset,
} from "./themePresets.js";
import {
  fetchThemeBackgroundFromApi,
  isThemeApiConfigured,
} from "./themeApiAdapter.js";
import {
  readThemeBackgroundCache,
  writeThemeBackgroundCache,
} from "./themeBackgroundCache.js";

/**
 * @param {{ from: string, to: string, angle?: number }} gradient
 * @param {number} width
 * @param {number} height
 */
async function renderGradientBackground(gradient, width, height) {
  const angle = gradient.angle ?? 135;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" gradientTransform="rotate(${angle})">
          <stop offset="0%" stop-color="${gradient.from}" />
          <stop offset="100%" stop-color="${gradient.to}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * @param {string} assetPath
 * @param {number} width
 * @param {number} height
 */
async function loadAssetBackground(assetPath, width, height) {
  return sharp(assetPath)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

/**
 * Resolve theme background with priority:
 * local asset → disk cache → external API (cached) → gradient.
 * @param {{ themeId: string, width: number, height: number }} params
 * @returns {Promise<{ buffer: Buffer, source: 'asset' | 'cache' | 'api' | 'gradient' }>}
 */
export async function resolveThemeBackground({ themeId, width, height }) {
  const preset = getThemePreset(themeId);
  const assetPath = getThemeAssetPath(preset);

  if (assetPath) {
    const buffer = await loadAssetBackground(assetPath, width, height);
    return { buffer, source: "asset" };
  }

  const cached = await readThemeBackgroundCache(themeId, width, height);
  if (cached) {
    return { buffer: cached, source: "cache" };
  }

  if (isThemeApiConfigured()) {
    try {
      const buffer = await fetchThemeBackgroundFromApi({
        prompt: preset.prompt,
        width,
        height,
        themeId: preset.id,
      });
      await writeThemeBackgroundCache(themeId, width, height, buffer);
      return { buffer, source: "api" };
    } catch (err) {
      console.warn(
        `[theme] API fallback for ${preset.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const buffer = await renderGradientBackground(preset.gradient, width, height);
  return { buffer, source: "gradient" };
}

/**
 * Write resolved background to a temp file path for Sharp composite.
 * @param {{ themeId: string, width: number, height: number, outputPath: string }} params
 * @returns {Promise<'asset' | 'cache' | 'api' | 'gradient'>}
 */
export async function writeThemeBackgroundFile({
  themeId,
  width,
  height,
  outputPath,
}) {
  const { buffer, source } = await resolveThemeBackground({
    themeId,
    width,
    height,
  });

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, buffer);
  return source;
}
