import type { PaperMarginsMm } from "@/lib/paperSizes";
import { clampMargins } from "@/lib/resolvePaper";

const STORAGE_KEY = "sp_studio_paper_margins";

export function loadStudioPaperMargins(): PaperMarginsMm | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PaperMarginsMm;
    if (
      typeof parsed?.top !== "number" ||
      typeof parsed?.right !== "number" ||
      typeof parsed?.bottom !== "number" ||
      typeof parsed?.left !== "number"
    ) {
      return null;
    }
    return clampMargins(parsed);
  } catch {
    return null;
  }
}

export function saveStudioPaperMargins(margins: PaperMarginsMm) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampMargins(margins)));
  } catch {
    // ignore quota errors
  }
}
