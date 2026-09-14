import sharp from "sharp";
import { getThemePrintTune } from "./themePrintTune.js";

const FACE_PROTECT_RATIO =
  Number(process.env.PERSON_MASK_FACE_PROTECT_RATIO) || 0.2;

const ALPHA_SUBJECT_THRESHOLD = 32;

/**
 * Zero RGB on empty pixels so leftover booth-wall color cannot cover the theme.
 * @param {Buffer} buffer
 * @param {number} [threshold]
 */
export async function punchTransparentPixels(buffer, threshold = 8) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (!width || !height) return buffer;

  let dirty = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > threshold) continue;
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 0) {
      continue;
    }
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    dirty = true;
  }

  if (!dirty) return buffer;
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * @param {Buffer} alphaRaw
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 */
export function measureSubjectBounds(alphaRaw, width, height, channels = 1) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      if (alphaRaw[idx] >= ALPHA_SUBJECT_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Grayscale mask: 255 = protected face/hair region inside subject silhouette.
 * @param {Buffer} subjectBuffer PNG with alpha
 * @param {{ faceProtectRatio?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function buildFaceProtectMask(subjectBuffer, options = {}) {
  const faceProtectRatio = options.faceProtectRatio ?? FACE_PROTECT_RATIO;
  const meta = await sharp(subjectBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height) {
    throw new Error("invalid_subject_dimensions");
  }

  const alphaRaw = await sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  const bounds = measureSubjectBounds(alphaRaw, width, height, 1);
  const maskAlpha = Buffer.alloc(width * height);

  if (!bounds) {
    return sharp(maskAlpha, {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();
  }

  const subjectH = bounds.maxY - bounds.minY + 1;
  const subjectW = bounds.maxX - bounds.minX + 1;
  const faceCutoffY = bounds.minY + Math.round(subjectH * faceProtectRatio);
  const headCx = (bounds.minX + bounds.maxX) / 2;
  const headRx = subjectW * 0.38;
  const headCy = bounds.minY + subjectH * faceProtectRatio * 0.55;
  const headRy = Math.max(8, (faceCutoffY - bounds.minY) * 0.72);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const subjectAlpha = alphaRaw[y * width + x];
      const idx = y * width + x;

      if (subjectAlpha < ALPHA_SUBJECT_THRESHOLD || y > faceCutoffY) {
        maskAlpha[idx] = 0;
        continue;
      }

      const nx = (x - headCx) / headRx;
      const ny = (y - headCy) / headRy;
      maskAlpha[idx] = nx * nx + ny * ny <= 1 ? 255 : 0;
    }
  }

  return sharp(maskAlpha, {
    raw: { width, height, channels: 1 },
  })
    .png()
    .toBuffer();
}

/**
 * Build OpenAI edit mask PNG: transparent = preserve, opaque = editable.
 * Protects upper face region inside subject bounds; body/clothing editable.
 * @param {Buffer} subjectBuffer PNG with alpha
 * @param {{ faceProtectRatio?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function buildCostumeEditMask(subjectBuffer, options = {}) {
  const meta = await sharp(subjectBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height) {
    throw new Error("invalid_subject_dimensions");
  }

  const [alphaRaw, faceMaskRaw] = await Promise.all([
    sharp(subjectBuffer).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
    buildFaceProtectMask(subjectBuffer, options).then((mask) =>
      sharp(mask).greyscale().raw().toBuffer()
    ),
  ]);

  const maskAlpha = Buffer.alloc(width * height);

  for (let i = 0; i < width * height; i += 1) {
    if (alphaRaw[i] < ALPHA_SUBJECT_THRESHOLD) {
      maskAlpha[i] = 0;
      continue;
    }

    maskAlpha[i] = faceMaskRaw[i] >= 128 ? 0 : 255;
  }

  return sharp(maskAlpha, {
    raw: { width, height, channels: 1 },
  })
    .png()
    .toBuffer();
}

/**
 * Extract alpha channel as standalone grayscale mask for debugging/compositing.
 * @param {Buffer} subjectBuffer
 */
export async function buildSegmentAlphaMask(subjectBuffer) {
  return sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .png()
    .toBuffer();
}

/**
 * Resize mask to match OpenAI source dimensions and emit RGBA PNG.
 * Transparent pixels = preserve; opaque white = editable (OpenAI edits convention).
 * @param {Buffer} maskBuffer
 * @param {number} width
 * @param {number} height
 */
export async function normalizeMaskForOpenAiEdit(maskBuffer, width, height) {
  const { data, info } = await sharp(maskBuffer)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width ?? width;
  const h = info.height ?? height;
  const rgba = Buffer.alloc(w * h * 4);

  for (let i = 0; i < w * h; i += 1) {
    const editable = data[i] >= 128;
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = editable ? 255 : 0;
  }

  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Kill black fringe: opaque interior RGB fills semi-transparent edges.
 * @param {Buffer} subjectBuffer
 */
export async function cleanSubjectMatte(subjectBuffer) {
  const { data, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const channels = info.channels ?? 4;
  if (!width || !height || channels < 4) return subjectBuffer;

  const out = Buffer.from(data);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const a = out[i + 3];
      if (a === 0) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        continue;
      }
      if (a >= 250) continue;

      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const y0 = Math.max(0, y - 3);
      const y1 = Math.min(height - 1, y + 3);
      const x0 = Math.max(0, x - 3);
      const x1 = Math.min(width - 1, x + 3);
      for (let yy = y0; yy <= y1; yy += 1) {
        for (let xx = x0; xx <= x1; xx += 1) {
          const j = (yy * width + xx) * 4;
          if (data[j + 3] < 220) continue;
          r += data[j];
          g += data[j + 1];
          b += data[j + 2];
          n += 1;
        }
      }

      const luma = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
      if (n > 0) {
        out[i] = Math.round(r / n);
        out[i + 1] = Math.round(g / n);
        out[i + 2] = Math.round(b / n);
      }
      if (luma < 28 && a < 200) {
        out[i + 3] = Math.round(a * 0.08);
      } else if (a >= 210) {
        out[i + 3] = 255;
      }
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * Fill pinholes, drop dust halos, keep hair wisps in the upper silhouette.
 * @param {Buffer} subjectBuffer
 */
export async function stabilizePrintMatte(subjectBuffer) {
  const cleaned = await cleanSubjectMatte(subjectBuffer);
  const { data, info } = await sharp(cleaned)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (!width || !height) return cleaned;

  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i += 1) {
    alpha[i] = data[i * 4 + 3];
  }

  const blurred = await sharp(alpha, {
    raw: { width, height, channels: 1 },
  })
    .blur(1.45)
    .raw()
    .toBuffer();

  const hairHalo = getThemePrintTune().hairHaloKill;
  const bounds = measureSubjectBounds(alpha, width, height, 1);
  const hairY1 = bounds
    ? bounds.minY + Math.round((bounds.maxY - bounds.minY + 1) * 0.38)
    : Math.round(height * 0.32);

  const stabilized = Buffer.alloc(width * height);
  for (let i = 0; i < alpha.length; i += 1) {
    const y = Math.floor(i / width);
    const a = alpha[i];
    const b = blurred[i];
    const inHair = y <= hairY1;
    const luma =
      0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];

    if (a < 16 && b < 72) {
      stabilized[i] = 0;
      continue;
    }

    if (inHair && luma > 138 && a < 240) {
      const light = Math.min(1, (luma - 138) / 90);
      const fringe = 1 - a / 255;
      stabilized[i] = Math.round(
        a * (1 - hairHalo * light * (0.48 + 0.4 * fringe))
      );
      continue;
    }

    if (!inHair && b > 150 && a > 28 && a < 210) {
      stabilized[i] = Math.min(255, Math.round(a * 0.28 + b * 0.72));
      continue;
    }

    if (inHair && luma < 150) {
      if (a < 10 && b < 48) {
        stabilized[i] = 0;
      } else {
        stabilized[i] = a;
      }
      continue;
    }

    stabilized[i] = a;
  }

  const rgba = Buffer.from(data);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4 + 3] = stabilized[i];
    if (stabilized[i] === 0) {
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
    }
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * Combine OpenAI edited RGB with segmentation alpha for theme composite.
 * Clothing pixels come from the edit; face/hands stay on the original.
 * @param {Buffer} editedBuffer
 * @param {Buffer} subjectBuffer
 * @param {{ originalPath?: string, editMaskBuffer?: Buffer | null }} [options]
 */
export async function buildCompositeSubjectFromEdited(
  editedBuffer,
  subjectBuffer,
  options = {}
) {
  const subMeta = await sharp(subjectBuffer).metadata();
  const targetW = subMeta.width ?? 0;
  const targetH = subMeta.height ?? 0;

  if (!targetW || !targetH) {
    throw new Error("invalid_subject_dimensions");
  }

  const cleaned = await cleanSubjectMatte(subjectBuffer);
  const alpha = await sharp(cleaned)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize(targetW, targetH, { fit: "fill" })
    .toBuffer();

  const editedRgb = await sharp(editedBuffer)
    .resize(targetW, targetH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  let rgb = editedRgb;

  if (options.originalPath) {
    const originalRgb = await sharp(options.originalPath, {
      failOn: "none",
      limitInputPixels: false,
    })
      .rotate()
      .resize(targetW, targetH, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer();

    let maskRaw = null;
    if (options.editMaskBuffer) {
      maskRaw = await sharp(options.editMaskBuffer)
        .resize(targetW, targetH, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer();
    }

    rgb = Buffer.alloc(targetW * targetH * 3);
    for (let i = 0; i < targetW * targetH; i += 1) {
      const useEdit = maskRaw ? maskRaw[i] >= 128 : true;
      const o = i * 3;
      const src = useEdit ? editedRgb : originalRgb;
      rgb[o] = src[o];
      rgb[o + 1] = src[o + 1];
      rgb[o + 2] = src[o + 2];
    }
  }

  const merged = await sharp(rgb, {
    raw: { width: targetW, height: targetH, channels: 3 },
  })
    .joinChannel(alpha)
    .ensureAlpha()
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();

  return cleanSubjectMatte(merged);
}
