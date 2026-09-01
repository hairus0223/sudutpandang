import sharp from "sharp";
import { buildFaceProtectMask } from "./personMask.js";
import {
  getPersonSegmentationStatus,
  PERSON_SEGMENTATION_ENABLED,
} from "./personSegmentation.js";

/** Opt-in: blends original face pixels onto AI-edited output (PR-3). */
export const FACE_REFINE_ENABLED = process.env.FACE_REFINE_ENABLED === "true";

const FACE_REFINE_BLEND_STRENGTH =
  Number(process.env.FACE_REFINE_BLEND_STRENGTH) || 0.85;

const FACE_REFINE_FEATHER_PX =
  Number(process.env.FACE_REFINE_FEATHER_PX) || 8;

/**
 * @returns {boolean}
 */
export function isFaceRefineAvailable() {
  if (!FACE_REFINE_ENABLED) return false;
  if (!PERSON_SEGMENTATION_ENABLED) return false;
  return getPersonSegmentationStatus().assetsFound;
}

export function getFaceRefineStatus() {
  return {
    enabled: FACE_REFINE_ENABLED,
    available: isFaceRefineAvailable(),
    blendStrength: FACE_REFINE_BLEND_STRENGTH,
    featherPx: FACE_REFINE_FEATHER_PX,
  };
}

/**
 * Blend original face region onto an AI-edited frame using segmentation bounds.
 * @param {{
 *   originalPath: string,
 *   editedBuffer: Buffer,
 *   subjectBuffer: Buffer,
 *   strength?: number,
 *   featherPx?: number,
 * }} params
 * @returns {Promise<Buffer>}
 */
export async function refineEditedFaceFromOriginal({
  originalPath,
  editedBuffer,
  subjectBuffer,
  strength = FACE_REFINE_BLEND_STRENGTH,
  featherPx = FACE_REFINE_FEATHER_PX,
}) {
  if (strength <= 0) {
    return editedBuffer;
  }

  const editMeta = await sharp(editedBuffer).metadata();
  const width = editMeta.width ?? 0;
  const height = editMeta.height ?? 0;

  if (!width || !height) {
    return editedBuffer;
  }

  const [originalRgb, editedRgb, faceMaskRaw] = await Promise.all([
    sharp(originalPath, { failOn: "none", limitInputPixels: false })
      .rotate()
      .resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(editedBuffer)
      .resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer(),
    buildFaceProtectMask(subjectBuffer).then((mask) =>
      sharp(mask)
        .resize(width, height, { fit: "fill" })
        .greyscale()
        .blur(Math.max(0, featherPx))
        .raw()
        .toBuffer()
    ),
  ]);

  const pixelCount = width * height;
  const out = Buffer.alloc(pixelCount * 3);

  for (let i = 0; i < pixelCount; i += 1) {
    const blend = (faceMaskRaw[i] / 255) * strength;
    const inv = 1 - blend;
    const o = i * 3;

    out[o] = Math.round(editedRgb[o] * inv + originalRgb[o] * blend);
    out[o + 1] = Math.round(editedRgb[o + 1] * inv + originalRgb[o + 1] * blend);
    out[o + 2] = Math.round(editedRgb[o + 2] * inv + originalRgb[o + 2] * blend);
  }

  return sharp(out, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
