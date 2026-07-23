import sharp from "sharp";

const MAX_INPUT_PX =
  Number(process.env.PERSON_SEGMENTATION_MAX_INPUT_PX) || 4096;

/**
 * Normalize camera JPEG to display-oriented pixels for segmentation.
 * @param {string} inputPath
 */
export async function prepareSegmentationInput(inputPath) {
  let buffer = await sharp(inputPath, {
    failOn: "none",
    limitInputPixels: false,
  })
    .rotate()
    .png({ compressionLevel: 6, effort: 7 })
    .toBuffer();

  let meta = await sharp(buffer).metadata();
  let targetWidth = meta.width ?? 0;
  let targetHeight = meta.height ?? 0;

  if (targetWidth > MAX_INPUT_PX || targetHeight > MAX_INPUT_PX) {
    buffer = await sharp(buffer)
      .resize({
        width: MAX_INPUT_PX,
        height: MAX_INPUT_PX,
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 6, effort: 7 })
      .toBuffer();

    meta = await sharp(buffer).metadata();
    targetWidth = meta.width ?? targetWidth;
    targetHeight = meta.height ?? targetHeight;
  }

  buffer = await sharp(buffer)
    .ensureAlpha()
    .withMetadata({ orientation: 1 })
    .png({ compressionLevel: 6, effort: 10 })
    .toBuffer();

  return {
    buffer,
    targetWidth,
    targetHeight,
  };
}

/**
 * @param {Buffer} buffer
 * @param {number} targetWidth
 * @param {number} targetHeight
 */
export async function alignSubjectDimensions(buffer, targetWidth, targetHeight) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height || !targetWidth || !targetHeight) {
    return buffer;
  }

  if (width === targetWidth && height === targetHeight) {
    return buffer;
  }

  if (width === targetHeight && height === targetWidth) {
    return sharp(buffer)
      .rotate(90)
      .withMetadata({ orientation: 1 })
      .png()
      .toBuffer();
  }

  return sharp(buffer)
    .resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .withMetadata({ orientation: 1 })
    .png()
    .toBuffer();
}

/**
 * imgly foreground PNGs sometimes ship alpha in a compressed 0–8 range.
 * Stretch to full 0–255 so silhouette masks and face refine work reliably.
 * @param {Buffer} buffer
 */
export async function normalizeSubjectAlphaRange(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height) return buffer;

    const alpha = await sharp(buffer).ensureAlpha().extractChannel("alpha").raw().toBuffer();
    let max = 0;
    for (let i = 0; i < alpha.length; i += 1) {
      if (alpha[i] > max) max = alpha[i];
    }

    if (max === 0 || max >= 240) {
      return buffer;
    }

    const scale = 255 / max;
    const scaled = Buffer.alloc(alpha.length);
    for (let i = 0; i < alpha.length; i += 1) {
      scaled[i] = Math.min(255, Math.round(alpha[i] * scale));
    }

    const alphaPng = await sharp(scaled, {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    return sharp(buffer)
      .removeAlpha()
      .joinChannel(alphaPng)
      .ensureAlpha()
      .withMetadata({ orientation: 1 })
      .png({ compressionLevel: 6, effort: 10 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * @param {Buffer} buffer
 */
export async function refineSubjectAlpha(buffer) {
  if (process.env.PERSON_SEGMENTATION_ALPHA_REFINE === "false") {
    return buffer;
  }

  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      return buffer;
    }

    const alpha = await sharp(buffer)
      .ensureAlpha()
      .extractChannel("alpha")
      .blur(0.25)
      .toBuffer();

    return sharp(buffer)
      .removeAlpha()
      .joinChannel(alpha)
      .ensureAlpha()
      .withMetadata({ orientation: 1 })
      .png({ compressionLevel: 6, effort: 10 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * @param {Buffer} buffer
 */
export async function finalizeSubjectPng(buffer) {
  return sharp(buffer)
    .ensureAlpha()
    .withMetadata({ orientation: 1 })
    .png({ compressionLevel: 6, effort: 10 })
    .toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {number} targetWidth
 * @param {number} targetHeight
 */
export async function postProcessSubjectBuffer(buffer, targetWidth, targetHeight) {
  let result = await alignSubjectDimensions(buffer, targetWidth, targetHeight);
  result = await normalizeSubjectAlphaRange(result);
  result = await refineSubjectAlpha(result);
  return finalizeSubjectPng(result);
}
