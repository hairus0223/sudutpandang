import type { PhotoTransform } from "@/stores/useGalleryStore";

const STORAGE_PREFIX = "sp_sheet_transforms";

function getTodayFolder() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${today.getFullYear()}`;
}

export function getTransformStorageKey(user: string, dateFolder?: string) {
  return `${STORAGE_PREFIX}:${dateFolder ?? getTodayFolder()}:${user}`;
}

export function loadSheetSlotTransforms(
  user: string
): Record<string, PhotoTransform> {
  if (typeof window === "undefined" || !user) return {};

  try {
    const raw = localStorage.getItem(getTransformStorageKey(user));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PhotoTransform>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSheetSlotTransforms(
  user: string,
  transforms: Record<string, PhotoTransform>
) {
  if (typeof window === "undefined" || !user) return;

  try {
    localStorage.setItem(
      getTransformStorageKey(user),
      JSON.stringify(transforms)
    );
  } catch {
    // ignore quota errors
  }
}
