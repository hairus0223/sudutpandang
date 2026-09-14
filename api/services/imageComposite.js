import sharp from "sharp";
import {
  applyLookBakeToBuffer,
  applyVignette,
  normalizeLookId,
} from "./lookPresets.js";
import { measureSubjectBounds, punchTransparentPixels, buildFaceProtectMask } from "./personMask.js";
import { getThemePrintTune } from "./themePrintTune.js";
import {
  applyOpticalBackdrop,
  opticalBlurSigma,
} from "./themeCameraBokeh.js";

/**
 * @param {{ r: number, g: number, b: number }} c
 */
function luminance(c) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Blur a 1-channel matte and always return width*height bytes.
 * Sharp may promote raw grey to RGBA after blur; reading that as grey
 * zeros the silhouette and the person disappears from the theme.
 * @param {Buffer} alpha
 * @param {number} width
 * @param {number} height
 * @param {number} sigma
 */
async function blurMono(alpha, width, height, sigma) {
  const { data, info } = await sharp(alpha, {
    raw: { width, height, channels: 1 },
  })
    .blur(Math.max(0.3, sigma))
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });

  if ((info.channels ?? 1) === 1 && data.length === width * height) {
    return data;
  }

  const channels = info.channels ?? 4;
  const out = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i += 1) {
    out[i] = data[i * channels];
  }
  return out;
}

/**
 * Straight-alpha over, then opaque RGB so JPEG cannot drop the subject.
 * @param {Buffer} bgBuffer
 * @param {Buffer} subjectBuffer
 * @param {number} width
 * @param {number} height
 */
async function flattenSubjectOverBackground(bgBuffer, subjectBuffer, width, height) {
  const bg = await sharp(bgBuffer)
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sub = await sharp(subjectBuffer)
    .ensureAlpha()
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(bg.data);
  const s = sub.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3];
    out[i + 3] = 255;
    if (a < 1) continue;
    if (a >= 254) {
      out[i] = s[i];
      out[i + 1] = s[i + 1];
      out[i + 2] = s[i + 2];
      continue;
    }
    const t = a / 255;
    const u = 1 - t;
    out[i] = Math.round(s[i] * t + out[i] * u);
    out[i + 1] = Math.round(s[i + 1] * t + out[i + 1] * u);
    out[i + 2] = Math.round(s[i + 2] * t + out[i + 2] * u);
  }

  return sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * Alpha feather: extra-soft hair silhouette, medium body, plus a 2–3px
 * falloff even when the matte is a hard 0/255 cut.
 * @param {Buffer} buffer
 * @param {number} radius
 */
export async function featherSubjectAlpha(buffer, radius) {
  const tune = getThemePrintTune();
  const feather = radius == null ? tune.alphaFeather : radius;
  const hairFeather = Number(tune.hairFeather) || 1.65;
  if (feather <= 0 && hairFeather <= 0) return buffer;

  try {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = info.width ?? 0;
    const height = info.height ?? 0;
    if (!width || !height) return buffer;

    const alpha = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i += 1) {
      alpha[i] = data[i * 4 + 3];
    }

    const bounds = measureSubjectBounds(alpha, width, height, 1);
    const hairY1 = bounds
      ? bounds.minY + Math.round((bounds.maxY - bounds.minY + 1) * 0.44)
      : Math.round(height * 0.36);

    const hairRadius = Math.max(1.05, hairFeather * 1.18, feather * 0.95);
    const bodyRadius = Math.max(0.95, feather * 1.55);
    const ringRadius = 1.15;

    const [hairAlpha, bodyAlpha, ringAlpha] = await Promise.all([
      blurMono(alpha, width, height, hairRadius),
      blurMono(alpha, width, height, bodyRadius),
      blurMono(alpha, width, height, ringRadius),
    ]);

    const mixed = Buffer.alloc(width * height);
    const fade = Math.max(10, Math.round(height * 0.07));
    let mixedOpaque = 0;
    for (let y = 0; y < height; y += 1) {
      const t =
        y <= hairY1
          ? 0
          : y >= hairY1 + fade
            ? 1
            : (y - hairY1) / fade;
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        let v = Math.round(hairAlpha[i] * (1 - t) + bodyAlpha[i] * t);
        const orig = alpha[i];
        const ring = ringAlpha[i];
        if (orig > 236 && ring < 248) {
          v = Math.min(v, Math.round(v * 0.28 + ring * 0.72));
        }
        mixed[i] = v;
        if (v >= 40) mixedOpaque += 1;
      }
    }

    let sourceOpaque = 0;
    for (let i = 0; i < alpha.length; i += 1) {
      if (alpha[i] >= 40) sourceOpaque += 1;
    }
    if (sourceOpaque > 200 && mixedOpaque < Math.max(40, sourceOpaque * 0.05)) {
      return buffer;
    }

    const out = Buffer.from(data);
    for (let i = 0; i < width * height; i += 1) {
      const a = mixed[i];
      const o = i * 4;
      out[o + 3] = a;
      if (a < 8) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
        out[o + 3] = 0;
      }
    }

    return sharp(out, { raw: { width, height, channels: 4 } })
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
 * Neutralize neon/sky chroma so skin matching does not paint the person blue.
 * @param {{ r: number, g: number, b: number }} c
 */
function neutralizeAmbient(c) {
  const l = luminance(c);
  const max = Math.max(c.r, c.g, c.b, 1);
  const min = Math.min(c.r, c.g, c.b);
  const sat = (max - min) / max;
  if (sat < 0.18) return c;
  const t = Math.min(0.78, (sat - 0.18) / 0.55);
  return {
    r: c.r * (1 - t) + l * t,
    g: c.g * (1 - t) + l * t,
    b: c.b * (1 - t) + l * t,
  };
}

function tempDeltaSafe(delta) {
  return Number.isFinite(delta) ? delta : 0;
}

/**
 * Ambient from side/ground patches of the *sharp* theme (not the bokeh soup).
 * @param {Buffer} bgBuffer
 * @param {number} width
 * @param {number} height
 */
async function sampleBackgroundAmbient(bgBuffer, width, height) {
  const patches = [
    {
      left: Math.max(0, Math.floor(width * 0.04)),
      top: Math.max(0, Math.floor(height * 0.08)),
      width: Math.max(12, Math.floor(width * 0.2)),
      height: Math.max(12, Math.floor(height * 0.42)),
    },
    {
      left: Math.min(width - 16, Math.floor(width * 0.76)),
      top: Math.max(0, Math.floor(height * 0.08)),
      width: Math.max(12, Math.floor(width * 0.2)),
      height: Math.max(12, Math.floor(height * 0.42)),
    },
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const box of patches) {
    const w = Math.min(box.width, width - box.left);
    const h = Math.min(box.height, height - box.top);
    if (w < 8 || h < 8) continue;
    const stats = await sharp(bgBuffer)
      .extract({ ...box, width: w, height: h })
      .stats();
    r += stats.channels[0]?.mean ?? 128;
    g += stats.channels[1]?.mean ?? 128;
    b += stats.channels[2]?.mean ?? 128;
    n += 1;
  }

  if (!n) return { r: 128, g: 128, b: 128 };
  return neutralizeAmbient({ r: r / n, g: g / n, b: b / n });
}

/**
 * 0 = far / full-body (scene readable). 1 = close selfie (stronger portrait bokeh).
 * @param {Buffer} subjectBuffer
 */
async function estimateShotProximity(subjectBuffer) {
  try {
    const preview = await sharp(subjectBuffer)
      .ensureAlpha()
      .resize(96, 144, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { data, info } = preview;
    const width = info.width ?? 1;
    const height = info.height ?? 1;
    const alpha = Buffer.alloc(width * height);
    let opaque = 0;
    for (let i = 0; i < width * height; i += 1) {
      alpha[i] = data[i * 4 + 3];
      if (alpha[i] >= 40) opaque += 1;
    }
    const bounds = measureSubjectBounds(alpha, width, height, 1);
    if (!bounds) return 0.42;
    const subW = (bounds.maxX - bounds.minX + 1) / width;
    const subH = (bounds.maxY - bounds.minY + 1) / height;
    const coverage = opaque / (width * height);

    let faceH = subH * 0.3;
    let skin = 0;
    const yFace1 = bounds.minY + Math.round((bounds.maxY - bounds.minY + 1) * 0.42);
    for (let y = bounds.minY; y <= Math.min(bounds.maxY, yFace1); y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const o = (y * width + x) * 4;
        if (data[o + 3] < 80) continue;
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        if (r > 80 && g > 35 && b > 20 && r >= g && r - b > 12) skin += 1;
      }
    }
    const faceArea = Math.max(1, width * height * 0.04);
    if (skin > faceArea * 0.08) {
      faceH = Math.min(0.55, 0.16 + skin / (width * height));
    }

    const fromWidth = Math.max(0, Math.min(1, (subW - 0.26) / 0.52));
    const fromFace = Math.max(0, Math.min(1, (faceH - 0.12) / 0.32));
    const fromCover = Math.max(0, Math.min(1, (coverage - 0.1) / 0.32));
    return Math.max(
      0,
      Math.min(1, fromWidth * 0.4 + fromFace * 0.35 + fromCover * 0.25)
    );
  } catch {
    return 0.45;
  }
}

/**
 * Pull subject brightness / warmth toward scene lights — never recolor the theme BG.
 * @param {Buffer} subjectBuffer
 * @param {{ r: number, g: number, b: number }} bgAmbient
 */
async function harmonizeSubjectColors(subjectBuffer, bgAmbient) {
  const tune = getThemePrintTune();
  const matchOn = tune.harmonize !== false;
  const strength = matchOn ? Number(tune.colorMatch ?? 0.55) : 0;
  const warmth = Number(tune.warmth ?? 0);
  if (strength <= 0.02 && Math.abs(warmth) < 0.15) return subjectBuffer;

  const subjectAmbient = await sampleSubjectOpaque(subjectBuffer);
  const subL = Math.max(1, luminance(subjectAmbient));
  const bgL = Math.max(1, luminance(bgAmbient));

  const brightness =
    strength > 0.02
      ? Math.max(0.9, Math.min(1.12, 1 + (bgL / subL - 1) * 0.34 * strength))
      : 1;

  const subTemp = subjectAmbient.r - subjectAmbient.b;
  const bgTemp = bgAmbient.r - bgAmbient.b;
  const hue = Math.round(
    Math.max(
      -8,
      Math.min(
        8,
        (strength > 0.02 ? tempDeltaSafe(bgTemp - subTemp) * 0.11 * strength : 0) +
          warmth +
          (bgTemp > 18 ? Math.min(5, bgTemp * 0.04) : 0)
      )
    )
  );

  const saturation =
    strength > 0.02
      ? Math.max(
          0.96,
          Math.min(1.06, 1 + (bgL > 150 ? 0.03 : bgL < 70 ? -0.03 : 0) * strength)
        )
      : 1;

  if (Math.abs(brightness - 1) < 0.004 && hue === 0 && Math.abs(saturation - 1) < 0.004) {
    return subjectBuffer;
  }

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
  const ellipseW = Math.max(36, Math.round(subjectW * 0.72));
  const ellipseH = Math.max(14, Math.round(height * 0.035));
  const cy = Math.min(height - 3, Math.max(ellipseH, maxY + Math.round(ellipseH * 0.15)));
  const blurPx = Math.max(8, Math.round(ellipseW * 0.12));

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="${cx}" cy="${cy}" rx="${ellipseW / 2}" ry="${ellipseH / 2}"
        fill="rgba(0,0,0,0.28)"/>
    </svg>`
  );

  return sharp(svg)
    .blur(blurPx)
    .ensureAlpha()
    .png()
    .toBuffer();
}

/**
 * Soft-light wrap so the subject picks up scene color instead of looking like a sticker.
 * @param {Buffer} subjectBuffer
 * @param {Buffer} bgBuffer
 * @param {number} width
 * @param {number} height
 */
async function wrapSubjectInSceneLight(subjectBuffer, bgBuffer, width, height) {
  const tune = getThemePrintTune();
  if (tune.lightWrap <= 0) return subjectBuffer;

  const wrap = await sharp(bgBuffer)
    .resize(width, height, { fit: "cover" })
    .blur(7)
    .ensureAlpha()
    .toBuffer();

  const wrapped = await sharp(subjectBuffer)
    .ensureAlpha()
    .composite([
      {
        input: wrap,
        blend: "soft-light",
      },
    ])
    .png()
    .toBuffer();

  const { data: src, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: lit } = await sharp(wrapped)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let face = Buffer.alloc(width * height);
  try {
    face = await sharp(await buildFaceProtectMask(subjectBuffer))
      .greyscale()
      .resize(width, height, { fit: "fill" })
      .raw()
      .toBuffer();
  } catch {
    face = Buffer.alloc(width * height);
  }

  const out = Buffer.alloc(src.length);
  const amount = tune.lightWrap;
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    out[i + 3] = a;
    if (a < 8) continue;
    const p = i / 4;
    const faceW = face[p] / 255;
    const edge = Math.pow(1 - a / 255, 0.48);
    const interior = 0.38 * (1 - faceW);
    const t = amount * (interior + 0.9 * edge) * (1 - faceW * 0.72);
    out[i] = Math.round(src[i] * (1 - t) + lit[i] * t);
    out[i + 1] = Math.round(src[i + 1] * (1 - t) + lit[i + 1] * t);
    out[i + 2] = Math.round(src[i + 2] * (1 - t) + lit[i + 2] * t);
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}

/**
 * Pull semi-transparent crop edges toward local background color so the
 * silhouette grades into the scene instead of showing a cut line.
 * @param {Buffer} subjectBuffer
 * @param {Buffer} bgBuffer
 * @param {number} width
 * @param {number} height
 */
async function blendFringeTowardBackground(
  subjectBuffer,
  bgBuffer,
  width,
  height
) {
  const tune = getThemePrintTune();
  if (tune.edgeBgBlend <= 0 && tune.hairHaloKill <= 0) return subjectBuffer;

  const { data: src, info } = await sharp(subjectBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: bg } = await sharp(bgBuffer)
    .ensureAlpha()
    .resize(info.width, info.height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alpha = Buffer.alloc(info.width * info.height);
  for (let p = 0; p < alpha.length; p += 1) {
    alpha[p] = src[p * 4 + 3];
  }
  const softAlpha = await blurMono(alpha, info.width, info.height, 2.35);

  const bounds = measureSubjectBounds(alpha, info.width, info.height, 1);
  const hairY1 = bounds
    ? bounds.minY + Math.round((bounds.maxY - bounds.minY + 1) * 0.46)
    : Math.round(info.height * 0.36);

  const out = Buffer.from(src);
  const edgeAmt = tune.edgeBgBlend;
  const haloAmt = tune.hairHaloKill;
  const hairFeather = Number(tune.hairFeather) || 1.65;

  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    if (a < 3) continue;

    const p = i / 4;
    const y = Math.floor(p / info.width);
    const inHair = y <= hairY1;
    const soft = softAlpha[p];
    const luma = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2];
    const light = Math.max(0, Math.min(1, (luma - 108) / 105));
    const fringe = Math.pow(1 - a / 255, 0.52);
    const ring = Math.max(0, (a - soft) / 255);
    const nearCut = a > 40 && soft < 248 ? Math.pow(1 - soft / 255, 0.62) : 0;
    const edge = Math.min(1, Math.max(fringe, ring * 1.35, nearCut) * edgeAmt);
    const halo =
      inHair
        ? haloAmt * light * (0.42 + 0.58 * Math.max(fringe, nearCut, ring))
        : 0;
    const t = Math.min(1, Math.max(edge, halo));
    if (t <= 0.008) continue;

    out[i] = Math.round(src[i] * (1 - t) + bg[i] * t);
    out[i + 1] = Math.round(src[i + 1] * (1 - t) + bg[i + 1] * t);
    out[i + 2] = Math.round(src[i + 2] * (1 - t) + bg[i + 2] * t);

    if (inHair && (light > 0.18 || a < 220)) {
      const drop =
        haloAmt * light * 0.58 +
        hairFeather * 0.12 * Math.max(fringe, nearCut);
      out[i + 3] = Math.round(a * (1 - Math.min(0.72, drop)));
    }
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 6, effort: 8 })
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
 * @param {{ harmonize?: boolean, lookId?: string | null, lookIntensity?: number, cinematicFinish?: boolean }} [options.harmonizeOptions]
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

  const tune = getThemePrintTune();

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

  if (background.type !== "image") {
    throw new Error(`Unsupported background type: ${background.type}`);
  }

  const matchSkin =
    tune.harmonize && harmonizeOptions?.harmonize !== false;

  let subjectBuffer = await punchTransparentPixels(
    await sharp(subjectPath).ensureAlpha().png().toBuffer()
  );
  subjectBuffer = await punchTransparentPixels(
    await featherSubjectAlpha(subjectBuffer)
  );

  const proximity =
    tune.autoFocus !== false ? await estimateShotProximity(subjectBuffer) : 0.4;
  const focusDistanceM =
    tune.autoFocus !== false ? 2.3 - proximity * 1.1 : 1.8;
  const sigma = opticalBlurSigma({
    focalLengthMm: tune.focalLengthMm,
    aperture: tune.aperture,
    focusDistanceM,
    backdropDistanceM: tune.backdropDistanceM,
  });

  const bgSharp = await applyOpticalBackdrop(background.path, width, height, 0);
  const bgAmbient = await sampleBackgroundAmbient(bgSharp, width, height);
  const bgBuffer = await applyOpticalBackdrop(
    background.path,
    width,
    height,
    sigma
  );

  if (matchSkin || Number(tune.warmth ?? 0) !== 0) {
    subjectBuffer = await harmonizeSubjectColors(subjectBuffer, bgAmbient);
  }

  subjectBuffer = await wrapSubjectInSceneLight(
    subjectBuffer,
    bgSharp,
    width,
    height
  );
  subjectBuffer = await punchTransparentPixels(
    await blendFringeTowardBackground(
      subjectBuffer,
      bgBuffer,
      width,
      height
    )
  );

  if (tune.lookBake) {
    const lookId = normalizeLookId(
      harmonizeOptions?.lookId,
      "theme-self-photo"
    );
    const intensity = Math.min(
      0.22,
      harmonizeOptions?.lookIntensity ?? 0.18
    );
    const alpha = await sharp(subjectBuffer)
      .ensureAlpha()
      .extractChannel("alpha")
      .toBuffer();
    const baked = await applyLookBakeToBuffer(
      await sharp(subjectBuffer).removeAlpha().png().toBuffer(),
      lookId,
      intensity
    );
    subjectBuffer = await punchTransparentPixels(
      await sharp(baked)
        .removeAlpha()
        .joinChannel(alpha)
        .ensureAlpha()
        .png({ compressionLevel: 6, effort: 8 })
        .toBuffer()
    );
  }

  let sceneBg = bgBuffer;
  if (tune.contactShadow) {
    const shadow = await buildContactShadow(subjectBuffer, width, height);
    if (shadow) {
      sceneBg = await sharp(bgBuffer)
        .removeAlpha()
        .ensureAlpha()
        .composite([{ input: shadow, blend: "multiply" }])
        .png({ compressionLevel: 6, effort: 8 })
        .toBuffer();
    }
  }

  let composited = await flattenSubjectOverBackground(
    sceneBg,
    subjectBuffer,
    width,
    height
  );

  if (tune.cinematicFinish && harmonizeOptions?.cinematicFinish !== false) {
    const amount = Number(
      harmonizeOptions?.cinematicIntensity ?? tune.cinematicIntensity ?? 0.2
    );
    composited = await applyVignette(composited, Math.min(0.16, 0.28 * amount));
  }

  await sharp(composited).png({ compressionLevel: 6, effort: 8 }).toFile(outputPath);
  return outputPath;
}
