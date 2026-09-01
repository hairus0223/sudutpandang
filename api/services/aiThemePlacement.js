import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * @typedef {{ scale?: number, yOffset?: number }} ThemePlacement
 */

const DEFAULT_PLACEMENT = {
  scale: 0.94,
  yOffset: 0.03,
};

/**
 * @param {unknown} value
 * @returns {ThemePlacement}
 */
export function normalizeThemePlacement(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PLACEMENT };
  }

  const entry = /** @type {Record<string, unknown>} */ (value);
  const scaleRaw = Number(entry.scale);
  const yOffsetRaw = Number(entry.yOffset);

  return {
    scale: Number.isFinite(scaleRaw)
      ? Math.max(0.72, Math.min(1.08, scaleRaw))
      : DEFAULT_PLACEMENT.scale,
    yOffset: Number.isFinite(yOffsetRaw)
      ? Math.max(0, Math.min(0.12, yOffsetRaw))
      : DEFAULT_PLACEMENT.yOffset,
  };
}

/**
 * Resize subject and anchor feet near the lower third for booth composite.
 * @param {string} subjectPath
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {ThemePlacement} [placement]
 * @returns {Promise<Buffer>}
 */
export async function renderSubjectWithPlacement(
  subjectPath,
  canvasW,
  canvasH,
  placement = DEFAULT_PLACEMENT
) {
  const normalized = normalizeThemePlacement(placement);
  const meta = await sharp(subjectPath).metadata();
  const sourceW = meta.width ?? canvasW;
  const sourceH = meta.height ?? canvasH;

  const targetW = Math.round(canvasW * normalized.scale);
  const targetH = Math.round(sourceH * (targetW / sourceW));

  const resized = await sharp(subjectPath)
    .resize(targetW, targetH, { fit: "inside" })
    .png()
    .toBuffer();

  const left = Math.max(0, Math.round((canvasW - targetW) / 2));
  const bottomPad = Math.round(canvasH * (0.04 + normalized.yOffset));
  const top = Math.max(0, Math.min(canvasH - targetH, canvasH - targetH - bottomPad));

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * @param {string} subjectPath
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {ThemePlacement} [placement]
 * @param {string} [outPath]
 */
export async function writePlacedSubjectFile(
  subjectPath,
  canvasW,
  canvasH,
  placement,
  outPath
) {
  const buffer = await renderSubjectWithPlacement(
    subjectPath,
    canvasW,
    canvasH,
    placement
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, buffer);
  return outPath;
}
