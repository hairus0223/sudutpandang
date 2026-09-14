import sharp from "sharp";
import { buildFaceProtectMask } from "./personMask.js";

const ALPHA_SUBJECT_THRESHOLD = 32;
const MIN_SUBJECT_COVERAGE =
  Number(process.env.AI_IDENTITY_MIN_SUBJECT_COVERAGE) || 0.04;
const MIN_FACE_IOU = Number(process.env.AI_IDENTITY_FACE_IOU_MIN) || 0.35;

/**
 * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} a
 * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} b
 */
export function bboxIou(a, b) {
  if (!a || !b) return 0;
  const x1 = Math.max(a.minX, b.minX);
  const y1 = Math.max(a.minY, b.minY);
  const x2 = Math.min(a.maxX, b.maxX);
  const y2 = Math.min(a.maxY, b.maxY);
  const inter = Math.max(0, x2 - x1 + 1) * Math.max(0, y2 - y1 + 1);
  const areaA = (a.maxX - a.minX + 1) * (a.maxY - a.minY + 1);
  const areaB = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

/**
 * @param {Buffer} maskRaw
 * @param {number} width
 * @param {number} height
 * @param {number} [threshold]
 */
export function measureOpaqueBounds(maskRaw, width, height, threshold = ALPHA_SUBJECT_THRESHOLD) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (maskRaw[y * width + x] >= threshold) {
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, count };
}

/**
 * @param {Buffer} subjectBuffer
 */
export async function assertSubjectMatte(subjectBuffer) {
  const meta = await sharp(subjectBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new Error("segmentation_failed");
  }

  const alphaRaw = await sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  const bounds = measureOpaqueBounds(alphaRaw, width, height);
  const coverage = bounds ? bounds.count / (width * height) : 0;

  if (!bounds || coverage < MIN_SUBJECT_COVERAGE) {
    throw new Error("segmentation_failed");
  }

  return { width, height, bounds, coverage };
}

/**
 * @param {Buffer} subjectBuffer
 */
export async function measureFaceBoundsFromSubject(subjectBuffer) {
  const mask = await buildFaceProtectMask(subjectBuffer);
  const meta = await sharp(mask).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const raw = await sharp(mask).greyscale().raw().toBuffer();
  return measureOpaqueBounds(raw, width, height, 24);
}

/**
 * Rough skin-region bbox in the upper half of an RGB portrait (pose-shift check).
 * @param {Buffer} imageBuffer
 * @param {number} width
 * @param {number} height
 */
export function measureSkinBounds(rgb, width, height) {
  const yMax = Math.max(1, Math.floor(height * 0.52));
  const mask = Buffer.alloc(width * height);

  for (let y = 0; y < yMax; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 3;
      const r = rgb[o];
      const g = rgb[o + 1];
      const b = rgb[o + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const skin =
        r > 80 &&
        g > 35 &&
        b > 20 &&
        r >= g &&
        r - b > 12 &&
        max - min > 18;
      if (skin) mask[y * width + x] = 255;
    }
  }

  const bounds = measureOpaqueBounds(mask, width, height, 128);
  if (!bounds || bounds.count < width * height * 0.004) return null;
  return bounds;
}

/**
 * Fail the costume job if the edited face is far from the source face location.
 * @param {{
 *   originalPath: string,
 *   editedBuffer: Buffer,
 *   subjectBuffer: Buffer,
 * }} params
 */
export async function assertIdentityLock({ originalPath, editedBuffer, subjectBuffer }) {
  const faceBoundsNative = await measureFaceBoundsFromSubject(subjectBuffer);
  if (!faceBoundsNative) {
    throw new Error("identity_mismatch");
  }

  const subjectMeta = await sharp(subjectBuffer).metadata();
  const subjectW = subjectMeta.width ?? 0;
  const subjectH = subjectMeta.height ?? 0;

  const editMeta = await sharp(editedBuffer).metadata();
  const width = editMeta.width ?? 0;
  const height = editMeta.height ?? 0;
  if (!width || !height || !subjectW || !subjectH) {
    throw new Error("identity_mismatch");
  }

  const scaleX = width / subjectW;
  const scaleY = height / subjectH;
  const faceBounds = {
    minX: Math.round(faceBoundsNative.minX * scaleX),
    minY: Math.round(faceBoundsNative.minY * scaleY),
    maxX: Math.round(faceBoundsNative.maxX * scaleX),
    maxY: Math.round(faceBoundsNative.maxY * scaleY),
    count: faceBoundsNative.count,
  };

  const [originalRgb, editedRgb] = await Promise.all([
    sharp(originalPath, { failOn: "none", limitInputPixels: false })
      .rotate()
      .resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(editedBuffer).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer(),
  ]);

  const originalSkin = measureSkinBounds(originalRgb, width, height);
  const editedSkin = measureSkinBounds(editedRgb, width, height);

  if (originalSkin && !editedSkin) {
    throw new Error("identity_mismatch");
  }

  if (originalSkin && editedSkin) {
    const iou = bboxIou(originalSkin, editedSkin);
    if (iou < MIN_FACE_IOU) {
      throw new Error("identity_mismatch");
    }

    const cxOrig = (faceBounds.minX + faceBounds.maxX) / 2;
    const cyOrig = (faceBounds.minY + faceBounds.maxY) / 2;
    const faceH = faceBounds.maxY - faceBounds.minY + 1;
    const faceW = faceBounds.maxX - faceBounds.minX + 1;
    const cxEdit = (editedSkin.minX + editedSkin.maxX) / 2;
    const cyEdit = (editedSkin.minY + editedSkin.maxY) / 2;
    const shiftX = Math.abs(cxEdit - cxOrig) / Math.max(1, faceW);
    const shiftY = Math.abs(cyEdit - cyOrig) / Math.max(1, faceH);
    if (shiftX > 0.55 || shiftY > 0.55) {
      throw new Error("identity_mismatch");
    }
  }
}
