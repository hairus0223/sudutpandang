import sharp from "sharp";

const FACE_PROTECT_RATIO =
  Number(process.env.PERSON_MASK_FACE_PROTECT_RATIO) || 0.32;

const ALPHA_SUBJECT_THRESHOLD = 32;

/**
 * @param {Buffer} alphaRaw
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 */
function measureSubjectBounds(alphaRaw, width, height, channels = 1) {
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

  const faceCutoffY =
    bounds.minY + Math.round((bounds.maxY - bounds.minY + 1) * faceProtectRatio);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const subjectAlpha = alphaRaw[y * width + x];
      const idx = y * width + x;

      if (subjectAlpha < ALPHA_SUBJECT_THRESHOLD || y > faceCutoffY) {
        maskAlpha[idx] = 0;
        continue;
      }

      maskAlpha[idx] = 255;
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
 * Combine OpenAI edited RGB with segmentation alpha for theme composite.
 * @param {Buffer} editedBuffer
 * @param {Buffer} subjectBuffer
 */
export async function buildCompositeSubjectFromEdited(editedBuffer, subjectBuffer) {
  const subMeta = await sharp(subjectBuffer).metadata();
  const targetW = subMeta.width ?? 0;
  const targetH = subMeta.height ?? 0;

  if (!targetW || !targetH) {
    throw new Error("invalid_subject_dimensions");
  }

  const editedRgb = await sharp(editedBuffer)
    .resize(targetW, targetH, { fit: "fill" })
    .removeAlpha()
    .toBuffer();

  const alpha = await sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize(targetW, targetH, { fit: "fill" })
    .toBuffer();

  return sharp(editedRgb)
    .joinChannel(alpha)
    .ensureAlpha()
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}
