import {
  getPaperPreset,
  type PaperMarginsMm,
  type PaperPreset,
} from "@/lib/paperSizes";

export const MARGIN_MIN_MM = 0;
export const MARGIN_MAX_MM = 25;

export function clampMarginMm(value: number): number {
  return Math.min(MARGIN_MAX_MM, Math.max(MARGIN_MIN_MM, Math.round(value)));
}

export function clampMargins(margins: PaperMarginsMm): PaperMarginsMm {
  return {
    top: clampMarginMm(margins.top),
    right: clampMarginMm(margins.right),
    bottom: clampMarginMm(margins.bottom),
    left: clampMarginMm(margins.left),
  };
}

export function resolvePaperForLayout(
  paperId: string,
  marginOverride?: PaperMarginsMm | null
): PaperPreset {
  const base = getPaperPreset(paperId);
  if (!marginOverride) return base;

  return {
    ...base,
    marginMm: clampMargins(marginOverride),
  };
}
