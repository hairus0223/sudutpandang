import sharp from "sharp";

const MAX_INPUT_PX =
  Number(process.env.BG_REMOVAL_MAX_INPUT_PX) || 4096;

/**
 * Normalize camera JPEG to display-oriented pixels (portrait stays portrait).
 * @param {string} inputPath
 * @returns {Promise<{ buffer: Buffer, targetWidth: number, targetHeight: number, orientation: number }>}
 */
export async function prepareOrientedInput(inputPath) {
  const sourceMeta = await sharp(inputPath, {
    failOn: "none",
    limitInputPixels: false,
  }).metadata();

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

  if (
    targetWidth > MAX_INPUT_PX ||
    targetHeight > MAX_INPUT_PX
  ) {
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
    orientation: sourceMeta.orientation ?? 1,
  };
}

/**
 * Restore orientation if imgly returns transposed dimensions.
 * @param {Buffer} buffer
 * @param {number} targetWidth
 * @param {number} targetHeight
 */
export async function alignSubjectDimensions(
  buffer,
  targetWidth,
  targetHeight
) {
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
 * Light edge anti-aliasing on alpha — never lifts fully transparent pixels.
 * @param {Buffer} buffer
 */
export async function refineSubjectAlpha(buffer) {
  if (process.env.BG_REMOVAL_ALPHA_REFINE === "false") {
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

/** @deprecated use refineSubjectAlpha */
export async function preserveSubjectAlpha(buffer) {
  return refineSubjectAlpha(buffer);
}
