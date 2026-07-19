import fs from "fs";
import path from "path";
import sharp from "sharp";
import { compositeSubject } from "./imageComposite.js";
import { LOOK_DEFAULT_INTENSITY, normalizeLookId } from "./lookPresets.js";
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
 * @param {{
 *   subjectPath: string,
 *   outputPath: string,
 *   themeId: string,
 *   lookId?: string | null,
 *   lookIntensity?: number,
 * }} options
 */
export async function applyThemeToSubject({
  subjectPath,
  outputPath,
  themeId,
  lookId,
  lookIntensity = LOOK_DEFAULT_INTENSITY,
}) {
  const preset = getThemePreset(themeId);
  const subjectMeta = await sharp(subjectPath).metadata();
  const width = subjectMeta.width;
  const height = subjectMeta.height;

  if (!width || !height) {
    throw new Error("Invalid subject image dimensions");
  }

  const resolvedLookId = normalizeLookId(lookId, "ai-photo");

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
      harmonizeOptions: {
        harmonize: true,
        lookId: resolvedLookId,
        lookIntensity,
      },
    });
  } finally {
    await fs.promises.unlink(tmpBg).catch(() => {});
  }

  console.log(
    `[theme] applied ${preset.id} look=${resolvedLookId} via ${source} → ${path.basename(outputPath)}`
  );
  return {
    outputPath,
    themeBackgroundSource: source,
    bakedLookId: resolvedLookId,
  };
}
