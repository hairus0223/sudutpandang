import sharp from "sharp";

const ENABLED = process.env.PASSPORT_RETOUCH !== "false";

/** Target mean luminance of the lit subject, 0–255. */
const TARGET_LUMA = Number(process.env.PASSPORT_TARGET_LUMA) || 148;

/** Clamp so a webcam frame is lifted but never blown out. */
const MIN_GAIN = 0.8;
const MAX_GAIN = 1.7;

/**
 * White balance is deliberately partial: the highlight reference can be a
 * coloured shirt instead of neutral skin, and over-correcting there drains
 * the skin tone — worse on a pas foto than a mild colour cast.
 */
const MAX_WB_SHIFT = 0.08;
const WB_STRENGTH = Number(process.env.PASSPORT_WB_STRENGTH) || 0.65;

const CONTRAST = Number(process.env.PASSPORT_CONTRAST) || 1.07;
const SATURATION = Number(process.env.PASSPORT_SATURATION) || 1.06;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Sample the segmented subject only — the removed background would otherwise
 * drag every measurement toward whatever the studio wall happened to be.
 *
 * @param {Buffer} subjectBuffer
 */
async function measureSubject(subjectBuffer) {
  const { data, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .resize(160, 160, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels ?? 4;
  const lumas = [];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let n = 0;

  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sumR += r;
    sumG += g;
    sumB += b;
    lumas.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    n += 1;
  }

  if (n < 32) return null;

  lumas.sort((a, b) => a - b);
  const meanLuma = lumas.reduce((acc, v) => acc + v, 0) / n;
  const highlightLuma = lumas[Math.floor(lumas.length * 0.92)];

  // White balance from the brightest decile: on a lit portrait that is skin
  // highlight or white clothing, both close to neutral in a correct exposure.
  const bright = [];
  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luma < highlightLuma || luma > 252) continue;
    bright.push([r, g, b]);
  }

  let wb = { r: 1, g: 1, b: 1 };
  if (bright.length >= 8) {
    let br = 0;
    let bg = 0;
    let bb = 0;
    for (const [r, g, b] of bright) {
      br += r;
      bg += g;
      bb += b;
    }
    br /= bright.length;
    bg /= bright.length;
    bb /= bright.length;
    const grey = (br + bg + bb) / 3;
    if (grey > 8) {
      const partial = (channelMean) =>
        clamp(
          1 + (grey / channelMean - 1) * WB_STRENGTH,
          1 - MAX_WB_SHIFT,
          1 + MAX_WB_SHIFT
        );
      wb = { r: partial(br), g: partial(bg), b: partial(bb) };
    }
  }

  return {
    meanLuma,
    gain: clamp(TARGET_LUMA / Math.max(1, meanLuma), MIN_GAIN, MAX_GAIN),
    wb,
    mean: { r: sumR / n, g: sumG / n, b: sumB / n },
  };
}

/**
 * Normalize webcam lighting to a studio look: neutral white balance, lifted
 * exposure, gentle contrast, and print sharpening. Alpha is preserved.
 *
 * @param {Buffer} subjectBuffer PNG with alpha
 * @returns {Promise<Buffer>}
 */
export async function retouchPassportSubject(subjectBuffer) {
  if (!ENABLED) return subjectBuffer;

  try {
    const stats = await measureSubject(subjectBuffer);
    if (!stats) return subjectBuffer;

    const alpha = await sharp(subjectBuffer)
      .ensureAlpha()
      .extractChannel("alpha")
      .raw()
      .toBuffer({ resolveWithObject: true });

    const offset = -(128 * (CONTRAST - 1));
    const rgb = await sharp(subjectBuffer)
      .removeAlpha()
      .toColourspace("srgb")
      .linear(
        [
          stats.gain * stats.wb.r * CONTRAST,
          stats.gain * stats.wb.g * CONTRAST,
          stats.gain * stats.wb.b * CONTRAST,
        ],
        [offset, offset, offset]
      )
      .modulate({ saturation: SATURATION })
      .sharpen({ sigma: 0.7, m1: 0.4, m2: 0.8 })
      .toBuffer();

    return sharp(rgb)
      .joinChannel(alpha.data, {
        raw: {
          width: alpha.info.width,
          height: alpha.info.height,
          channels: 1,
        },
      })
      .png({ compressionLevel: 6, effort: 8 })
      .toBuffer();
  } catch {
    return subjectBuffer;
  }
}
