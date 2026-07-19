import sharp from "sharp";
import {
  LOOK_DEFAULT_INTENSITY,
  applyLookBakeToBuffer,
  normalizeLookId,
} from "./lookPresets.js";

const THEME_HARMONIZE_ENABLED = process.env.THEME_HARMONIZE_ENABLED !== "false";
const THEME_CONTACT_SHADOW = process.env.THEME_CONTACT_SHADOW !== "false";
const THEME_LOOK_BAKE = process.env.THEME_LOOK_BAKE !== "false";
const THEME_ALPHA_FEATHER =
  Number(process.env.THEME_ALPHA_FEATHER) || 1.15;

/**
 * @param {{ r: number, g: number, b: number }} c
 */
function luminance(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Soft alpha feather for theme composites (stronger than passport refine).
 * @param {Buffer} buffer
 * @param {number} radius
 */
export async function featherSubjectAlpha(buffer, radius = THEME_ALPHA_FEATHER) {
  if (radius <= 0) return buffer;

  try {
    const alpha = await sharp(buffer)
      .ensureAlpha()
      .extractChannel("alpha")
      .blur(radius)
      .toBuffer();

    return sharp(buffer)
      .removeAlpha()
      .joinChannel(alpha)
      .ensureAlpha()
      .png({ compressionLevel: 6, effort: 8 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * Average opaque subject RGB (ignores near-transparent pixels).
 * @param {Buffer} subjectBuffer
 */
async function sampleSubjectOpaque(subjectBuffer) {
  const { data, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .resize(72, 72, { fit: "inside", kernel: sharp.kernel.nearest })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const { channels = 4 } = info;

  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] < 140) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }

  if (!n) return { r: 128, g: 128, b: 128 };
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Ambient sample from mid-lower background (typical stand zone).
 * @param {Buffer} bgBuffer
 * @param {number} width
 * @param {number} height
 */
async function sampleBackgroundAmbient(bgBuffer, width, height) {
  const sampleW = Math.max(16, Math.floor(width * 0.42));
  const sampleH = Math.max(16, Math.floor(height * 0.22));
  const left = Math.max(0, Math.floor((width - sampleW) / 2));
  const top = Math.max(0, Math.min(height - sampleH, Math.floor(height * 0.58)));

  const stats = await sharp(bgBuffer)
    .extract({ left, top, width: sampleW, height: sampleH })
    .stats();

  return {
    r: stats.channels[0]?.mean ?? 128,
    g: stats.channels[1]?.mean ?? 128,
    b: stats.channels[2]?.mean ?? 128,
  };
}

/**
 * Pull subject brightness / temperature toward background ambient.
 * @param {Buffer} subjectBuffer
 * @param {{ r: number, g: number, b: number }} bgAmbient
 */
async function harmonizeSubjectColors(subjectBuffer, bgAmbient) {
  const subjectAmbient = await sampleSubjectOpaque(subjectBuffer);
  const subL = Math.max(1, luminance(subjectAmbient));
  const bgL = Math.max(1, luminance(bgAmbient));

  const brightness = Math.max(
    0.88,
    Math.min(1.12, 1 + (bgL / subL - 1) * 0.42)
  );

  const subTemp = subjectAmbient.r - subjectAmbient.b;
  const bgTemp = bgAmbient.r - bgAmbient.b;
  const tempDelta = bgTemp - subTemp;
  const hue = Math.round(Math.max(-7, Math.min(7, tempDelta * 0.12)));

  const saturation = Math.max(
    0.92,
    Math.min(1.1, 1 + (bgL > 145 ? 0.04 : bgL < 90 ? -0.04 : 0))
  );

  const alpha = await sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .toBuffer();

  const rgb = await sharp(subjectBuffer)
    .removeAlpha()
    .modulate({
      brightness: Number(brightness.toFixed(4)),
      saturation: Number(saturation.toFixed(4)),
      hue,
    })
    .toBuffer();

  return sharp(rgb)
    .joinChannel(alpha)
    .ensureAlpha()
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * Soft elliptical contact shadow near subject feet.
 * @param {Buffer} subjectBuffer
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Buffer | null>}
 */
async function buildContactShadow(subjectBuffer, width, height) {
  const { data, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y += 1) {
    const row = y * w;
    for (let x = 0; x < w; x += 1) {
      if (data[row + x] < 48) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX <= minX || maxY <= minY) return null;

  const subjectW = maxX - minX;
  const cx = Math.round((minX + maxX) / 2);
  const ellipseW = Math.max(24, Math.round(subjectW * 0.52));
  const ellipseH = Math.max(10, Math.round(subjectW * 0.075));
  const cy = Math.min(height - 2, Math.max(ellipseH, maxY - Math.round(ellipseH * 0.25)));
  const blurPx = Math.max(5, Math.round(ellipseW * 0.09));

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${cx}" cy="${cy}" rx="${ellipseW / 2}" ry="${ellipseH / 2}"
        fill="rgba(0,0,0,0.42)"/>
    </svg>`
  );

  return sharp(svg)
    .blur(blurPx)
    .ensureAlpha()
    .png()
    .toBuffer();
}

/**
 * @param {Buffer | string} backgroundInput
 * @param {number} width
 * @param {number} height
 */
async function prepareBackgroundBuffer(backgroundInput, width, height) {
  return sharp(backgroundInput)
    .resize(width, height, { fit: "cover" })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/**
 * Flatten a transparent subject PNG onto a solid or image background.
 * Optional theme harmonization: feather, color match, contact shadow, look bake.
 *
 * @param {object} options
 * @param {string} options.subjectPath - Path to transparent PNG
 * @param {string} options.outputPath - Destination raster path
 * @param {{ type: 'solid', color: string } | { type: 'image', path: string }} options.background
 * @param {{ harmonize?: boolean, lookId?: string | null, lookIntensity?: number }} [options.harmonizeOptions]
 * @returns {Promise<string>}
 */
export async function compositeSubject({
  subjectPath,
  outputPath,
  background,
  harmonizeOptions,
}) {
  const subjectMeta = await sharp(subjectPath).metadata();
  const width = subjectMeta.width;
  const height = subjectMeta.height;

  if (!width || !height) {
    throw new Error("Invalid subject image dimensions");
  }

  const shouldHarmonize =
    THEME_HARMONIZE_ENABLED &&
    background.type === "image" &&
    harmonizeOptions?.harmonize !== false &&
    Boolean(harmonizeOptions);

  if (!shouldHarmonize) {
    if (background.type === "solid") {
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: background.color,
        },
      })
        .composite([{ input: subjectPath, top: 0, left: 0 }])
        .png()
        .toFile(outputPath);

      return outputPath;
    }

    if (background.type === "image") {
      await sharp(background.path)
        .resize(width, height, { fit: "cover" })
        .composite([{ input: subjectPath, top: 0, left: 0 }])
        .png()
        .toFile(outputPath);

      return outputPath;
    }

    throw new Error(`Unsupported background type: ${background.type}`);
  }

  let subjectBuffer = await sharp(subjectPath).ensureAlpha().png().toBuffer();
  subjectBuffer = await featherSubjectAlpha(subjectBuffer);

  const bgBuffer = await prepareBackgroundBuffer(background.path, width, height);
  const bgAmbient = await sampleBackgroundAmbient(bgBuffer, width, height);
  subjectBuffer = await harmonizeSubjectColors(subjectBuffer, bgAmbient);

  /** @type {import('sharp').OverlayOptions[]} */
  const layers = [];

  if (THEME_CONTACT_SHADOW) {
    const shadow = await buildContactShadow(subjectBuffer, width, height);
    if (shadow) {
      layers.push({ input: shadow, top: 0, left: 0, blend: "multiply" });
    }
  }

  layers.push({ input: subjectBuffer, top: 0, left: 0 });

  let composited = await sharp(bgBuffer).composite(layers).png().toBuffer();

  if (THEME_LOOK_BAKE) {
    const lookId = normalizeLookId(
      harmonizeOptions?.lookId,
      "ai-photo"
    );
    const intensity =
      harmonizeOptions?.lookIntensity ?? LOOK_DEFAULT_INTENSITY;
    composited = await applyLookBakeToBuffer(composited, lookId, intensity);
  }

  await sharp(composited).png({ compressionLevel: 6, effort: 8 }).toFile(outputPath);
  return outputPath;
}
