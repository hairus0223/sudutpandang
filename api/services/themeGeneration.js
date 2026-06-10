import fs from "fs";
import path from "path";
import sharp from "sharp";
import { compositeSubject } from "./imageComposite.js";
import { getThemePreset } from "./themePresets.js";

const THEME_API_URL = process.env.THEME_API_URL || null;
const THEME_API_KEY = process.env.THEME_API_KEY || null;

export const THEME_GENERATION_ENABLED = process.env.THEME_GENERATION_ENABLED !== "false";

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
 * Optional external theme API (POST JSON → image bytes).
 * @param {{ prompt: string, width: number, height: number }} params
 */
async function fetchExternalThemeBackground({ prompt, width, height }) {
  if (!THEME_API_URL || !THEME_API_KEY) {
    throw new Error("Theme API not configured");
  }

  const res = await fetch(THEME_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${THEME_API_KEY}`,
    },
    body: JSON.stringify({ prompt, width, height }),
  });

  if (!res.ok) {
    throw new Error(`Theme API failed: ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * @param {{ themeId: string, width: number, height: number }} params
 */
export async function generateThemeBackground({ themeId, width, height }) {
  const preset = getThemePreset(themeId);

  if (THEME_API_URL && THEME_API_KEY) {
    try {
      return await fetchExternalThemeBackground({
        prompt: preset.prompt,
        width,
        height,
      });
    } catch (err) {
      console.warn("Theme API fallback to local preset:", err.message);
    }
  }

  return renderGradientBackground(preset.gradient, width, height);
}

/**
 * Composite transparent subject onto a generated theme background.
 * @param {{ subjectPath: string, outputPath: string, themeId: string }} options
 */
export async function applyThemeToSubject({ subjectPath, outputPath, themeId }) {
  const subjectMeta = await sharp(subjectPath).metadata();
  const width = subjectMeta.width;
  const height = subjectMeta.height;

  if (!width || !height) {
    throw new Error("Invalid subject image dimensions");
  }

  const bgBuffer = await generateThemeBackground({ themeId, width, height });
  const tmpBg = path.join(
    path.dirname(outputPath),
    `.theme-bg-${themeId}-${Date.now()}.png`
  );

  await fs.promises.writeFile(tmpBg, bgBuffer);

  try {
    await compositeSubject({
      subjectPath,
      outputPath,
      background: { type: "image", path: tmpBg },
    });
  } finally {
    await fs.promises.unlink(tmpBg).catch(() => {});
  }

  return outputPath;
}
