import sharp from "sharp";

const ALPHA_SOLID = 40;

/** Head height as a fraction of the photo — bust/shoulder visible, not a face crop. */
const HEAD_HEIGHT_RATIO =
  Number(process.env.PASSPORT_HEAD_HEIGHT_RATIO) || 0.44;

/** Distance from the top edge to the crown, as a fraction of the photo height. */
const CROWN_MARGIN_RATIO =
  Number(process.env.PASSPORT_CROWN_MARGIN_RATIO) || 0.07;

/** A human head is roughly 1.35× taller than wide; used when the neck is not visible. */
const HEAD_ASPECT = 1.35;

/**
 * @typedef {object} SubjectGeometry
 * @property {number} width source width
 * @property {number} height source height
 * @property {number} crownY topmost hair pixel
 * @property {number} chinY estimated jaw/neck line
 * @property {number} headCenterX horizontal centre of the head
 * @property {number} headHeight crown → chin, in source pixels
 * @property {number} headWidth widest head row, in source pixels
 * @property {boolean} truncatedTop true when the mask starts at a flat cut
 */

function smooth(values, radius) {
  if (radius < 1) return values;
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let n = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue;
      sum += values[j];
      n += 1;
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

/**
 * Locate crown, head width and jaw line from the segmentation silhouette.
 * Walking down from the crown the width grows to the ears, narrows at the
 * neck, then jumps out again at the shoulders — the trough is the jaw line.
 *
 * @param {Buffer} subjectBuffer PNG with alpha
 * @returns {Promise<SubjectGeometry | null>}
 */
export async function analyzeSubjectGeometry(subjectBuffer) {
  const meta = await sharp(subjectBuffer).metadata();
  const srcWidth = meta.width ?? 0;
  const srcHeight = meta.height ?? 0;
  if (!srcWidth || !srcHeight) return null;

  const scale = Math.min(1, 400 / srcWidth);
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const alpha = await sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer();

  const rowWidth = new Float64Array(height);
  const rowCenter = new Float64Array(height);
  const minRun = Math.max(2, Math.round(width * 0.02));
  let crownY = -1;
  let bottomY = -1;

  for (let y = 0; y < height; y += 1) {
    let first = -1;
    let last = -1;
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] < ALPHA_SOLID) continue;
      if (first < 0) first = x;
      last = x;
      count += 1;
    }
    rowWidth[y] = count > 0 ? last - first + 1 : 0;
    rowCenter[y] = count > 0 ? (first + last) / 2 : 0;
    if (count >= minRun) {
      if (crownY < 0) crownY = y;
      bottomY = y;
    }
  }

  if (crownY < 0 || bottomY <= crownY) return null;

  const span = bottomY - crownY + 1;
  const widths = smooth(rowWidth, Math.max(1, Math.round(span * 0.015)));

  // Widest point of the head: rise from the crown until the width turns over.
  let peakY = crownY;
  let peakW = widths[crownY];
  const peakLimit = Math.min(bottomY, crownY + Math.round(span * 0.6));
  for (let y = crownY + 1; y <= peakLimit; y += 1) {
    if (widths[y] >= peakW) {
      peakW = widths[y];
      peakY = y;
      continue;
    }
    if (widths[y] < peakW * 0.94) break;
  }

  // Neck: narrowest row after the head before the shoulders widen again.
  let neckY = -1;
  let neckW = peakW;
  for (let y = peakY + 1; y <= bottomY; y += 1) {
    if (widths[y] <= neckW) {
      neckW = widths[y];
      neckY = y;
      continue;
    }
    if (neckY > 0 && widths[y] > neckW * 1.12) break;
  }

  const truncatedTop = widths[crownY] >= peakW * 0.78;

  const headWidth = peakW;
  let headHeight =
    neckY > crownY ? neckY - crownY : Math.round(headWidth * HEAD_ASPECT);

  // Keep the estimate inside plausible head proportions — but never invent
  // empty space above a chopped silhouette (that becomes a solid colour bar).
  if (!truncatedTop) {
    const minHead = headWidth * 1.1;
    const maxHead = headWidth * 1.65;
    headHeight = Math.min(maxHead, Math.max(minHead, headHeight));
  }

  let centerSum = 0;
  let centerN = 0;
  for (let y = crownY; y <= Math.min(bottomY, crownY + headHeight); y += 1) {
    if (rowWidth[y] < headWidth * 0.5) continue;
    centerSum += rowCenter[y];
    centerN += 1;
  }
  const headCenterX = centerN ? centerSum / centerN : width / 2;

  const inv = 1 / scale;
  return {
    width: srcWidth,
    height: srcHeight,
    crownY: crownY * inv,
    chinY: (crownY + headHeight) * inv,
    headCenterX: headCenterX * inv,
    headHeight: headHeight * inv,
    headWidth: headWidth * inv,
    subjectBottomY: bottomY * inv,
    truncatedTop,
  };
}

/**
 * Crop rectangle (in source pixels, may extend past the edges) that puts the
 * head at pas-foto proportions for a given output aspect ratio.
 *
 * @param {SubjectGeometry | null} geometry
 * @param {number} aspect output width / height
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function computePassportFraming(geometry, aspect) {
  if (!geometry || !aspect) return null;

  const {
    width: imgW,
    height: imgH,
    crownY,
    chinY,
    headHeight,
    headCenterX,
    subjectBottomY,
    truncatedTop,
  } = geometry;
  if (headHeight <= 0) return null;

  let frameH = headHeight / HEAD_HEIGHT_RATIO;
  const crownPad = truncatedTop ? frameH * 0.04 : frameH * CROWN_MARGIN_RATIO;
  let top = Math.max(0, crownY - crownPad);

  const shoulderY = Math.max(
    chinY ?? crownY + headHeight,
    (chinY ?? crownY + headHeight) + headHeight * 0.7
  );
  const bustY = Math.max(
    subjectBottomY ?? shoulderY,
    shoulderY
  );
  const minBottom = Math.min(imgH, bustY);
  if (top + frameH < minBottom) {
    frameH = minBottom - top;
  }

  let frameW = frameH * aspect;

  if (frameH > imgH * 2.2 || frameW > imgW * 2.2) return null;

  let left = headCenterX - frameW / 2;

  if (top + frameH > imgH) {
    const overflow = top + frameH - imgH;
    const canShift = Math.min(overflow, top);
    top -= canShift;
    if (top + frameH > imgH) {
      frameH = imgH - top;
      frameW = frameH * aspect;
      left = headCenterX - frameW / 2;
    }
  }

  if (left < -frameW * 0.25) left = -frameW * 0.25;
  if (left > imgW - frameW * 0.5) left = imgW - frameW * 0.5;
  top = Math.max(0, top);

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.max(8, Math.round(frameW)),
    height: Math.max(8, Math.round(frameH)),
  };
}
