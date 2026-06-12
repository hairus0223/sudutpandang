import fs from "fs";
import path from "path";
import sharp from "sharp";
import { compositeSubject } from "./imageComposite.js";
import { getThemePreset } from "./themePresets.js";
import { resolveThemeBackground } from "./themeBackgrounds.js";
import { recordThemeBackgroundSource } from "./themeSourceStats.js";

export const THEME_GENERATION_ENABLED = process.env.THEME_GENERATION_ENABLED !== "false";

/**
 * @param {{ themeId: string, width: number, height: number }} params
 */
export async function generateThemeBackground({ themeId, width, height }) {
  const { buffer } = await resolveThemeBackground({ themeId, width, height });
  return buffer;
}

/**
 * Composite transparent subject onto a generated theme background.
 * @param {{ subjectPath: string, outputPath: string, themeId: string }} options
 */
export async function applyThemeToSubject({ subjectPath, outputPath, themeId }) {
  const preset = getThemePreset(themeId);
  const subjectMeta = await sharp(subjectPath).metadata();
  const width = subjectMeta.width;
  const height = subjectMeta.height;

  if (!width || !height) {
    throw new Error("Invalid subject image dimensions");
  }

  const tmpBg = path.join(
    path.dirname(outputPath),
    `.theme-bg-${preset.id}-${Date.now()}.png`
  );

  const { buffer, source } = await resolveThemeBackground({
    themeId: preset.id,
    width,
    height,
  });

  recordThemeBackgroundSource(source);
  await fs.promises.writeFile(tmpBg, buffer);

  try {
    await compositeSubject({
      subjectPath,
      outputPath,
      background: { type: "image", path: tmpBg },
    });
  } finally {
    await fs.promises.unlink(tmpBg).catch(() => {});
  }

  console.log(`[theme] applied ${preset.id} via ${source} → ${path.basename(outputPath)}`);
  return { outputPath, themeBackgroundSource: source };
}
