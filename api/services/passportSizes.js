/** @typedef {{ id: string, label: string, widthMm: number, heightMm: number }} PassportSize */

export const PASSPORT_DPI = 300;

/** @type {PassportSize[]} */
export const PASSPORT_SIZE_PRESETS = [
  { id: "2x3", label: "2×3 cm", widthMm: 20, heightMm: 30 },
  { id: "3x4", label: "3×4 cm", widthMm: 30, heightMm: 40 },
  { id: "4x6", label: "4×6 cm", widthMm: 40, heightMm: 60 },
];

export const DEFAULT_PASSPORT_SIZE_ID = "3x4";

/**
 * @param {string | undefined | null} sizeId
 * @returns {PassportSize}
 */
export function getPassportSize(sizeId) {
  const found = PASSPORT_SIZE_PRESETS.find((preset) => preset.id === sizeId);
  return found ?? PASSPORT_SIZE_PRESETS.find((p) => p.id === DEFAULT_PASSPORT_SIZE_ID);
}

/**
 * @param {string | undefined | null} input
 * @returns {string}
 */
export function normalizePassportSizeId(input) {
  const id = String(input || DEFAULT_PASSPORT_SIZE_ID).trim();
  return getPassportSize(id).id;
}

/**
 * @param {PassportSize} size
 * @param {number} [dpi]
 */
export function passportSizeToPixels(size, dpi = PASSPORT_DPI) {
  return {
    widthPx: Math.round((size.widthMm / 25.4) * dpi),
    heightPx: Math.round((size.heightMm / 25.4) * dpi),
  };
}
