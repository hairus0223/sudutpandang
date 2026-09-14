import sharp from "sharp";

const OPAQUE = 128;
const HARD = 250;
const HAIR_FEATHER = 1.15;
const BODY_FEATHER = 0.7;

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isSkinTone(r, g, b) {
  const L = luma(r, g, b);
  return r > g && g >= b - 8 && r - b > 12 && L > 45 && L < 210;
}

function isNeutralBright(r, g, b) {
  const L = luma(r, g, b);
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  return L > 148 && maxc - minc < 42;
}

function isLikelyWall(r, g, b, bg, hairLuma) {
  if (isSkinTone(r, g, b)) return false;
  const L = luma(r, g, b);
  const dBg = colorDist(r, g, b, bg.r, bg.g, bg.b);
  if (dBg < 42) return true;
  if (isNeutralBright(r, g, b)) return true;
  if (hairLuma < 110 && L > 132 && dBg < 92) return true;
  return false;
}

function dilate(alpha, width, height, radius) {
  if (radius < 1) return Buffer.from(alpha);
  const out = Buffer.alloc(alpha.length);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      let max = 0;
      for (let yy = y0; yy <= y1; yy += 1) {
        const row = yy * width;
        for (let xx = x0; xx <= x1; xx += 1) {
          const v = alpha[row + xx];
          if (v > max) max = v;
        }
      }
      out[y * width + x] = max;
    }
  }
  return out;
}

function erode(alpha, width, height, radius) {
  if (radius < 1) return Buffer.from(alpha);
  const out = Buffer.alloc(alpha.length);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      let min = 255;
      for (let yy = y0; yy <= y1; yy += 1) {
        const row = yy * width;
        for (let xx = x0; xx <= x1; xx += 1) {
          const v = alpha[row + xx];
          if (v < min) min = v;
        }
      }
      out[y * width + x] = min;
    }
  }
  return out;
}

function closeMorph(alpha, width, height, radius) {
  return erode(dilate(alpha, width, height, radius), width, height, radius);
}

function sampleCorners(rgb, width, height, channels) {
  const border = Math.max(8, Math.round(Math.min(width, height) * 0.07));
  const lowerSkip = Math.round(height * 0.52);
  const samples = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const topOrSide = y < border || x < border || x >= width - border;
      if (!topOrSide || y >= lowerSkip) continue;
      const o = (y * width + x) * channels;
      samples.push([rgb[o], rgb[o + 1], rgb[o + 2]]);
    }
  }
  if (!samples.length) return { r: 220, g: 220, b: 220 };
  samples.sort((a, b) => luma(...a) - luma(...b));
  const mid = samples[Math.floor(samples.length / 2)];
  return { r: mid[0], g: mid[1], b: mid[2] };
}

function sampleHairLuma(binary, rgb, width, height, channels) {
  let sum = 0;
  let n = 0;
  const y1 = Math.min(height, Math.round(height * 0.42));
  for (let y = 0; y < y1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (binary[y * width + x] < OPAQUE) continue;
      const o = (y * width + x) * channels;
      const L = luma(rgb[o], rgb[o + 1], rgb[o + 2]);
      if (L > 140) continue;
      sum += L;
      n += 1;
    }
  }
  return n > 8 ? sum / n : 70;
}

/**
 * Anything transparent or wall-colored that touches the frame is background,
 * including white leftover inside hair that still connects to the wall.
 * White letters on a dark shirt stay — they are not connected to the border.
 */
function floodOutside(binary, rgb, width, height, channels, bg, hairLuma) {
  const outside = new Uint8Array(width * height);
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const canEnter = (x, y) => {
    const i = y * width + x;
    if (outside[i]) return false;
    if (binary[i] < OPAQUE) return true;
    const o = i * channels;
    return isLikelyWall(rgb[o], rgb[o + 1], rgb[o + 2], bg, hairLuma);
  };

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (!canEnter(x, y)) return;
    const i = y * width + x;
    outside[i] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head += 1;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  const out = Buffer.from(binary);
  for (let i = 0; i < out.length; i += 1) {
    if (outside[i]) out[i] = 0;
  }
  return out;
}

/**
 * Fill only dark/skin holes (eyes, shirt letters). Bright enclosed patches
 * in hair are leftover wall and must stay empty.
 */
function fillSubjectHoles(binary, rgb, width, height, channels, bg, hairLuma) {
  const outside = new Uint8Array(width * height);
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (outside[i] || binary[i] >= OPAQUE) return;
    outside[i] = 1;
    qx[tail] = x;
    qy[tail] = y;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    head += 1;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  const out = Buffer.from(binary);
  const hairY = Math.round(height * 0.45);
  for (let i = 0; i < out.length; i += 1) {
    if (outside[i] || out[i] >= OPAQUE) continue;
    const o = i * channels;
    const r = rgb[o];
    const g = rgb[o + 1];
    const b = rgb[o + 2];
    const y = Math.floor(i / width);
    if (y < hairY && isLikelyWall(r, g, b, bg, hairLuma)) continue;
    if (isLikelyWall(r, g, b, bg, hairLuma) && !isSkinTone(r, g, b)) continue;
    out[i] = 255;
  }
  return out;
}

function measureSilhouette(binary, width, height) {
  let minY = height;
  let maxY = -1;
  const rowW = new Float64Array(height);

  for (let y = 0; y < height; y += 1) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x += 1) {
      if (binary[y * width + x] < OPAQUE) continue;
      if (first < 0) first = x;
      last = x;
    }
    const w = first < 0 ? 0 : last - first + 1;
    rowW[y] = w;
    if (w > 0) {
      if (y < minY) minY = y;
      maxY = y;
    }
  }
  if (maxY < minY) return null;

  let peakW = rowW[minY];
  let peakY = minY;
  const peakLimit = Math.min(maxY, minY + Math.round((maxY - minY + 1) * 0.55));
  for (let y = minY + 1; y <= peakLimit; y += 1) {
    if (rowW[y] >= peakW) {
      peakW = rowW[y];
      peakY = y;
      continue;
    }
    if (rowW[y] < peakW * 0.94) break;
  }
  if (peakW < 8) return null;

  let neckY = peakY;
  let neckW = peakW;
  for (let y = peakY + 1; y <= maxY; y += 1) {
    if (rowW[y] <= neckW) {
      neckW = rowW[y];
      neckY = y;
      continue;
    }
    if (rowW[y] > neckW * 1.12) break;
  }

  let centerSum = 0;
  let centerN = 0;
  for (let y = minY; y <= Math.min(maxY, neckY || peakY); y += 1) {
    if (rowW[y] < peakW * 0.45) continue;
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x += 1) {
      if (binary[y * width + x] < OPAQUE) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first < 0) continue;
    centerSum += (first + last) / 2;
    centerN += 1;
  }

  return {
    minY,
    maxY,
    peakW,
    peakY,
    neckY,
    headCx: centerN ? centerSum / centerN : width / 2,
    truncatedTop: rowW[minY] >= peakW * 0.78 || minY > height * 0.08,
  };
}

function recoverHead(binary, rgb, width, height, channels, bg, hairLuma) {
  const shape = measureSilhouette(binary, width, height);
  if (!shape) return binary;

  const headH = Math.max(
    shape.peakW * 1.15,
    (shape.neckY > shape.minY ? shape.neckY : shape.minY + shape.peakW) -
      shape.minY
  );
  const extra = shape.truncatedTop
    ? Math.round(shape.peakW * 0.55)
    : Math.round(shape.peakW * 0.1);
  const rx = shape.peakW * 0.5;
  const ry = (headH + extra) * 0.52;
  const cx = shape.headCx;
  const cy = shape.minY + headH * 0.42 - extra * 0.35;
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx));

  const out = Buffer.from(binary);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny > 1) continue;
      const i = y * width + x;
      if (out[i] >= OPAQUE) continue;
      const o = i * channels;
      const r = rgb[o];
      const g = rgb[o + 1];
      const b = rgb[o + 2];
      if (isLikelyWall(r, g, b, bg, hairLuma)) continue;
      const L = luma(r, g, b);
      if (isSkinTone(r, g, b) || L < 145) {
        out[i] = 255;
      }
    }
  }
  return out;
}

function punchHairWall(binary, rgb, width, height, channels, bg, hairLuma) {
  const y1 = Math.min(height, Math.round(height * 0.48));
  const out = Buffer.from(binary);
  for (let y = 0; y < y1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (out[i] < OPAQUE) continue;
      const o = i * channels;
      if (isLikelyWall(rgb[o], rgb[o + 1], rgb[o + 2], bg, hairLuma)) {
        out[i] = 0;
      }
    }
  }
  return out;
}

async function featherAlpha(binary, width, height) {
  const hairH = Math.max(8, Math.round(height * 0.42));
  const full = await sharp(binary, { raw: { width, height, channels: 1 } })
    .png()
    .blur(BODY_FEATHER)
    .greyscale()
    .raw()
    .toBuffer();
  const hair = await sharp(binary, { raw: { width, height, channels: 1 } })
    .extract({ left: 0, top: 0, width, height: hairH })
    .png()
    .blur(HAIR_FEATHER)
    .greyscale()
    .raw()
    .toBuffer();

  const out = Buffer.from(full);
  for (let y = 0; y < hairH; y += 1) {
    const fade = y > hairH - 12 ? 1 - (y - (hairH - 12)) / 12 : 1;
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      out[i] = Math.round(full[i] * (1 - fade) + hair[i] * fade);
    }
  }
  return out;
}

/**
 * Rebuild a print-ready subject from the original camera pixels. The imgly
 * PNG is only a silhouette hint.
 *
 * @param {{ originalPath: string, subjectBuffer: Buffer }} options
 * @returns {Promise<Buffer>}
 */
export async function rebuildPassportSubject({ originalPath, subjectBuffer }) {
  const subjectMeta = await sharp(subjectBuffer).metadata();
  const width = subjectMeta.width ?? 0;
  const height = subjectMeta.height ?? 0;
  if (!width || !height) return subjectBuffer;

  const original = await sharp(originalPath, {
    failOn: "none",
    limitInputPixels: false,
  })
    .rotate()
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hint = await sharp(subjectBuffer)
    .ensureAlpha()
    .resize(width, height, { fit: "fill" })
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  const channels = original.info.channels;
  const rgb = original.data;

  const binary = Buffer.alloc(width * height);
  for (let i = 0; i < hint.length; i += 1) {
    binary[i] = hint[i] >= 96 ? 255 : 0;
  }

  const closed = closeMorph(binary, width, height, 1);
  const bg = sampleCorners(rgb, width, height, channels);
  const hairLuma = sampleHairLuma(closed, rgb, width, height, channels);
  const recovered = recoverHead(
    closed,
    rgb,
    width,
    height,
    channels,
    bg,
    hairLuma
  );
  const flooded = floodOutside(
    recovered,
    rgb,
    width,
    height,
    channels,
    bg,
    hairLuma
  );
  const hairClean = punchHairWall(
    flooded,
    rgb,
    width,
    height,
    channels,
    bg,
    hairLuma
  );
  const sealed = fillSubjectHoles(
    hairClean,
    rgb,
    width,
    height,
    channels,
    bg,
    hairLuma
  );
  const alphaPlane = await featherAlpha(sealed, width, height);

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    const s = i * channels;
    let a = alphaPlane[i];
    if (a >= HARD) a = 255;
    else if (a < 14) a = 0;

    const r0 = rgb[s];
    const g0 = rgb[s + 1];
    const b0 = rgb[s + 2];

    if (a > 0 && isLikelyWall(r0, g0, b0, bg, hairLuma) && a < 230) {
      a = 0;
    }

    if (a > 12 && a < 250) {
      const na = a / 255;
      const inv = 1 - na;
      rgba[o] = clampByte((r0 - bg.r * inv) / Math.max(0.18, na));
      rgba[o + 1] = clampByte((g0 - bg.g * inv) / Math.max(0.18, na));
      rgba[o + 2] = clampByte((b0 - bg.b * inv) / Math.max(0.18, na));
      if (isNeutralBright(rgba[o], rgba[o + 1], rgba[o + 2])) {
        a = Math.round(a * 0.15);
      }
    } else {
      rgba[o] = r0;
      rgba[o + 1] = g0;
      rgba[o + 2] = b0;
    }
    rgba[o + 3] = a;
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6, effort: 8 })
    .toBuffer();
}
