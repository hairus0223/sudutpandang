import sharp from "sharp";

const HAIR_BAND_RATIO = 0.42;
const MIN_ALPHA = 8;

/**
 * Soften hair-edge alpha and defringe leftover studio light so wisps sit
 * naturally on the passport color instead of a hard cut.
 * @param {Buffer} subjectBuffer PNG with alpha
 * @returns {Promise<Buffer>}
 */
export async function refinePassportHair(subjectBuffer) {
  const meta = await sharp(subjectBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return subjectBuffer;

  const { data, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels ?? 4;
  const alpha = Buffer.alloc(width * height);
  let minY = height;
  let maxY = -1;

  for (let i = 0; i < width * height; i += 1) {
    const a = data[i * channels + 3];
    alpha[i] = a;
    if (a >= MIN_ALPHA) {
      const y = Math.floor(i / width);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxY < minY) return subjectBuffer;

  const hairEndY = minY + Math.round((maxY - minY + 1) * HAIR_BAND_RATIO);
  const hairH = Math.max(8, Math.min(height, hairEndY + 16));

  const bodyBlur = await sharp(alpha, {
    raw: { width, height, channels: 1 },
  })
    .blur(0.55)
    .raw()
    .toBuffer();

  const hairBlur = await sharp(alpha, {
    raw: { width, height, channels: 1 },
  })
    .extract({ left: 0, top: 0, width, height: hairH })
    .blur(1.7)
    .raw()
    .toBuffer();

  const blended = Buffer.from(bodyBlur);
  for (let y = 0; y < hairH; y += 1) {
    const fade =
      y >= hairEndY ? Math.max(0, 1 - (y - hairEndY) / 16) : 1;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const hair = hairBlur[i] ?? blended[i];
      blended[i] = Math.round(blended[i] * (1 - fade) + hair * fade);
    }
  }

  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let bgN = 0;
  const border = Math.max(6, Math.round(Math.min(width, height) * 0.04));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge =
        x < border || y < border || x >= width - border || y >= height - border;
      if (!edge) continue;
      const i = y * width + x;
      if (alpha[i] >= 20) continue;
      const o = i * channels;
      bgR += data[o];
      bgG += data[o + 1];
      bgB += data[o + 2];
      bgN += 1;
    }
  }
  if (bgN > 0) {
    bgR /= bgN;
    bgG /= bgN;
    bgB /= bgN;
  }

  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i += 1) {
    const y = Math.floor(i / width);
    let a = blended[i];
    if (y <= hairEndY && a > 6 && a < 220) {
      a = Math.min(255, Math.round(a * 1.05 + 8));
    }
    const o = i * channels;
    const na = a / 255;
    if (na > 0.04 && na < 0.92 && bgN > 0) {
      const inv = 1 - na;
      out[o] = clampByte((data[o] - bgR * inv) / na);
      out[o + 1] = clampByte((data[o + 1] - bgG * inv) / na);
      out[o + 2] = clampByte((data[o + 2] - bgB * inv) / na);
    }
    out[o + 3] = a;
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
