import fs from "fs";
import path from "path";
import sharp from "sharp";
import { measureSubjectBounds, punchTransparentPixels } from "./personMask.js";

/**
 * @typedef {{ scale?: number, yOffset?: number }} ThemePlacement
 */

const DEFAULT_PLACEMENT = {
  scale: 0.94,
  yOffset: 0,
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
      ? Math.max(0.88, Math.min(1.08, scaleRaw))
      : DEFAULT_PLACEMENT.scale,
    yOffset: Number.isFinite(yOffsetRaw)
      ? Math.max(-0.02, Math.min(0.02, yOffsetRaw))
      : DEFAULT_PLACEMENT.yOffset,
  };
}

/**
 * Crop to the opaque silhouette, scale to fill the frame, pin the body
 * to the bottom so the theme does not show a gap under a sitting shot.
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
  const source = await sharp(subjectPath).ensureAlpha().png().toBuffer();
  const meta = await sharp(source).metadata();
  const sourceW = meta.width ?? canvasW;
  const sourceH = meta.height ?? canvasH;

  const { data: alphaRaw, info } = await sharp(source)
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = measureSubjectBounds(
    alphaRaw,
    info.width ?? sourceW,
    info.height ?? sourceH,
    1
  );

  if (!bounds) {
    return punchTransparentPixels(
      await sharp({
        create: {
          width: canvasW,
          height: canvasH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .png()
        .toBuffer()
    );
  }

  const pad = 6;
  const cropLeft = Math.max(0, bounds.minX - pad);
  const cropTop = Math.max(0, bounds.minY - pad);
  const cropRight = Math.min(sourceW, bounds.maxX + 1 + pad);
  const cropBottom = Math.min(sourceH, bounds.maxY + 1 + pad);
  const cropW = Math.max(1, cropRight - cropLeft);
  const cropH = Math.max(1, cropBottom - cropTop);

  const cropped = await sharp(source)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .png()
    .toBuffer();

  const fillW = canvasW * normalized.scale;
  const headroom = Math.round(canvasH * 0.05);
  const maxH = Math.max(32, canvasH - headroom);
  let scale = fillW / cropW;
  if (cropH * scale > maxH) scale = maxH / cropH;
  scale = Math.max(0.9, Math.min(1.38, scale));

  const targetW = Math.max(1, Math.round(cropW * scale));
  const targetH = Math.max(1, Math.round(cropH * scale));

  const resized = await sharp(cropped)
    .resize(targetW, targetH, { fit: "fill" })
    .png()
    .toBuffer();

  const overlap = Math.round(canvasH * normalized.yOffset);
  const left = Math.round((canvasW - targetW) / 2);
  let top = canvasH - targetH + overlap;
  if (top < 0) top = 0;

  const placed = await sharp({
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

  return punchTransparentPixels(placed);
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
