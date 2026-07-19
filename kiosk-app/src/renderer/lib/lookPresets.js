/** Soft lighting looks for live preview / review (mirrors print canvasFilters). */

export const LOOK_PRESETS = [
  { id: "natural", label: "Natural" },
  { id: "soft", label: "Soft" },
  { id: "warm", label: "Warm" },
  { id: "cinematic", label: "Cinematic" },
];

export const LOOK_PREVIEW_INTENSITY = 0.6;

export function defaultLookForPackage(packageType) {
  if (packageType === "pas-photo") return "natural";
  if (packageType === "ai-photo") return "natural";
  return "soft";
}

export function normalizeLookId(input, packageType) {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  if (LOOK_PRESETS.some((p) => p.id === raw)) return raw;
  return defaultLookForPackage(packageType);
}

/**
 * CSS filter string matching studio-kiosk canvasFilters at soft intensity.
 * @param {string | undefined | null} lookId
 * @param {number} [intensity]
 */
export function getLookCssFilter(lookId, intensity = LOOK_PREVIEW_INTENSITY) {
  const i = Math.max(0, Math.min(intensity, 1));
  const id = normalizeLookId(lookId);

  switch (id) {
    case "soft":
      return `brightness(${1 + 0.08 * i}) contrast(${1 - 0.05 * i}) saturate(${1 + 0.1 * i})`;
    case "warm":
      return `brightness(${1 + 0.05 * i}) saturate(${1 + 0.2 * i}) sepia(${0.1 * i})`;
    case "cinematic":
      return `contrast(${1 + 0.15 * i}) saturate(${1 + 0.05 * i}) brightness(${1 - 0.05 * i})`;
    case "natural":
    default:
      return "none";
  }
}

export function lookAllowsPicker(packageType) {
  return packageType !== "pas-photo";
}
