import sharp from "sharp";

/**
 * Thin-lens DoF for a 2D studio backdrop. Calibrated so 50mm f/4–f/5.6
 * keeps the theme photo readable (like a set behind the talent).
 */

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/**
 * How large the person is on the 3:4 canvas. Wider lens → more of the set.
 * @param {number} focalLengthMm
 */
export function subjectScaleForFocalLength(focalLengthMm) {
  const f = clamp(focalLengthMm, 24, 135);
  if (f <= 28) return 0.9;
  if (f <= 35) return 0.92;
  if (f <= 50) return 0.94;
  if (f <= 70) return 0.96;
  return 0.98;
}

/**
 * Background defocus in blur-sigma pixels (full-frame 24mm sensor analog).
 * @param {{
 *   focalLengthMm: number,
 *   aperture: number,
 *   focusDistanceM: number,
 *   backdropDistanceM: number,
 * }} optics
 */
export function opticalBlurSigma(optics) {
  const f = clamp(optics.focalLengthMm, 24, 135);
  const N = clamp(optics.aperture, 1.4, 16);
  const s1 = clamp(optics.focusDistanceM, 0.7, 4);
  const s2 = clamp(optics.backdropDistanceM, s1 + 0.35, 18);
  const defocus = Math.abs(s2 - s1) / s2;
  const sigma = (f / 50) * (2.8 / N) * defocus * 0.85;
  return Math.min(1.65, Math.max(0, sigma));
}

/**
 * Resize theme photo and apply mild optical defocus. Below ~0.4σ the
 * original pixels are returned unchanged so the set stays identical.
 * @param {Buffer | string} backgroundInput
 * @param {number} width
 * @param {number} height
 * @param {number} sigma
 */
export async function applyOpticalBackdrop(
  backgroundInput,
  width,
  height,
  sigma
) {
  const original = await sharp(backgroundInput)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre" })
    .removeAlpha()
    .ensureAlpha()
    .png({ compressionLevel: 4 })
    .toBuffer();

  if (sigma < 0.4) return original;

  const { data: src, info } = await sharp(original)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: soft } = await sharp(src, {
    raw: { width, height, channels: info.channels || 4 },
  })
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const keep = Math.min(0.92, 0.78 + (1.65 - sigma) * 0.08);
  const fade = 1 - keep;
  const mixed = Buffer.alloc(src.length);
  for (let i = 0; i < src.length; i += 4) {
    mixed[i] = Math.round(src[i] * keep + soft[i] * fade);
    mixed[i + 1] = Math.round(src[i + 1] * keep + soft[i + 1] * fade);
    mixed[i + 2] = Math.round(src[i + 2] * keep + soft[i + 2] * fade);
    mixed[i + 3] = 255;
  }

  return sharp(mixed, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}
