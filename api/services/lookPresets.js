import sharp from "sharp";

/** Soft lighting look presets — subtle grade, not beauty reshape. */

export const LOOK_IDS = /** @type {const} */ ([
  "natural",
  "soft",
  "warm",
  "cinematic",
]);

/** @typedef {(typeof LOOK_IDS)[number]} LookId */

export const LOOK_PRESETS = [
  { id: "natural", label: "Natural" },
  { id: "soft", label: "Soft" },
  { id: "warm", label: "Warm" },
  { id: "cinematic", label: "Cinematic" },
];

/** Preview / print default intensity (soft, not hard). */
export const LOOK_DEFAULT_INTENSITY = 0.6;

/**
 * @param {string | undefined | null} packageType
 * @returns {LookId}
 */
export function defaultLookForPackage(packageType) {
  if (packageType === "pas-photo") return "natural";
  if (packageType === "ai-photo") return "natural";
  return "soft";
}

/**
 * @param {string | undefined | null} input
 * @param {string | undefined | null} [packageType]
 * @returns {LookId}
 */
export function normalizeLookId(input, packageType) {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  if (LOOK_IDS.includes(/** @type {LookId} */ (raw))) {
    return /** @type {LookId} */ (raw);
  }
  return defaultLookForPackage(packageType);
}

/**
 * Map look → print PhotoFilter id (`natural` → `none`).
 * @param {string | undefined | null} lookId
 * @returns {string}
 */
export function lookIdToPhotoFilter(lookId) {
  const id = normalizeLookId(lookId);
  return id === "natural" ? "none" : id;
}

/**
 * Sharp adjustments mirroring studio-kiosk canvasFilters / kiosk CSS looks.
 * @param {string | undefined | null} lookId
 * @param {number} [intensity]
 * @returns {{
 *   brightness?: number,
 *   saturation?: number,
 *   hue?: number,
 *   linear?: { a: number, b: number },
 *   warmOverlayAlpha?: number,
 * } | null}
 */
export function getLookSharpAdjustments(lookId, intensity = LOOK_DEFAULT_INTENSITY) {
  const i = Math.max(0, Math.min(1, intensity));
  const id = normalizeLookId(lookId);

  switch (id) {
    case "soft": {
      const contrast = 1 - 0.05 * i;
      return {
        brightness: 1 + 0.08 * i,
        saturation: 1 + 0.1 * i,
        linear: { a: contrast, b: -128 * (contrast - 1) },
      };
    }
    case "warm":
      return {
        brightness: 1 + 0.05 * i,
        saturation: 1 + 0.2 * i,
        hue: Math.round(4 * i),
        warmOverlayAlpha: 0.1 * i,
      };
    case "cinematic": {
      const contrast = 1 + 0.15 * i;
      return {
        brightness: 1 - 0.05 * i,
        saturation: 1 + 0.05 * i,
        linear: { a: contrast, b: -128 * (contrast - 1) },
      };
    }
    case "natural":
    default:
      // Subtle unify grade so subject + BG share one finish.
      return {
        brightness: 1.01,
        saturation: 1.02,
        linear: { a: 1.02, b: -128 * 0.02 },
      };
  }
}

/**
 * Bake look grade into a flattened RGB(A) buffer (theme composite output).
 * @param {Buffer} buffer
 * @param {string | undefined | null} lookId
 * @param {number} [intensity]
 * @returns {Promise<Buffer>}
 */
export async function applyLookBakeToBuffer(
  buffer,
  lookId,
  intensity = LOOK_DEFAULT_INTENSITY
) {
  const adj = getLookSharpAdjustments(lookId, intensity);
  if (!adj) return buffer;

  let pipeline = sharp(buffer).ensureAlpha();

  if (
    adj.brightness != null ||
    adj.saturation != null ||
    adj.hue != null
  ) {
    pipeline = pipeline.modulate({
      brightness: Number((adj.brightness ?? 1).toFixed(4)),
      saturation: Number((adj.saturation ?? 1).toFixed(4)),
      hue: Math.round(adj.hue ?? 0),
    });
  }

  if (adj.linear) {
    pipeline = pipeline.linear(adj.linear.a, adj.linear.b);
  }

  let result = await pipeline.png().toBuffer();

  if (adj.warmOverlayAlpha && adj.warmOverlayAlpha > 0.01) {
    const meta = await sharp(result).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w && h) {
      const overlay = await sharp({
        create: {
          width: w,
          height: h,
          channels: 4,
          background: {
            r: 255,
            g: 214,
            b: 170,
            alpha: adj.warmOverlayAlpha,
          },
        },
      })
        .png()
        .toBuffer();

      result = await sharp(result)
        .composite([{ input: overlay, blend: "soft-light" }])
        .png()
        .toBuffer();
    }
  }

  return result;
}
