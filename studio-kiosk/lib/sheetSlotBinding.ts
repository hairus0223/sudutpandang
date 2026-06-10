import type { ImageData } from "@/stores/useGalleryStore";
import { getItemSizeKey } from "@/lib/sheetRecipe";
import type { SlotRect } from "@/utils/sheetLayoutEngine";

export type SheetBindingMode = "cycle" | "by-size" | "manual";

export { getItemSizeKey };

export function getSlotSizeKey(slot: SlotRect): string {
  return slot.sizeKey ?? slot.photoSizeId ?? "2x3";
}

export function findImageByFilename(
  images: ImageData[],
  filename: string | undefined
): ImageData | null {
  if (!filename) return null;
  return images.find((img) => img.filename === filename) ?? null;
}

/**
 * Resolve which gallery image fills a sheet slot.
 */
export function resolveSlotImage({
  slot,
  slotIndex,
  images,
  mode,
  sizeAssignments,
  slotAssignments,
  slots,
}: {
  slot: SlotRect;
  slotIndex: number;
  images: ImageData[];
  mode: SheetBindingMode;
  sizeAssignments: Record<string, string>;
  slotAssignments: Record<number, string>;
  slots: SlotRect[];
}): ImageData {
  if (!images.length) {
    throw new Error("No images available for sheet binding");
  }

  if (mode === "manual") {
    const assigned = findImageByFilename(images, slotAssignments[slotIndex]);
    if (assigned) return assigned;
    return images[slotIndex % images.length];
  }

  if (mode === "by-size") {
    const sizeKey = getSlotSizeKey(slot);
    const assigned = findImageByFilename(images, sizeAssignments[sizeKey]);
    if (assigned) return assigned;

    const uniqueSizeKeys = [
      ...new Set(slots.map((entry) => getSlotSizeKey(entry))),
    ];
    const sizeIdx = Math.max(0, uniqueSizeKeys.indexOf(sizeKey));
    return images[sizeIdx % images.length];
  }

  return images[slotIndex % images.length];
}
