import { getPhotoSizePreset } from "@/lib/photoSizes";
import {
  getSlotSizeKey,
  resolveSlotImage,
  type SheetBindingMode,
} from "@/lib/sheetSlotBinding";
import type { ImageData } from "@/stores/useGalleryStore";
import type { SlotRect } from "@/utils/sheetLayoutEngine";

export type SheetAdjustMeta = {
  slotIndex: number;
  filename: string;
  sizeKey: string;
  label: string;
};

export function buildAdjustMetaForSlot(
  slotIndex: number,
  slots: SlotRect[],
  images: ImageData[],
  options: {
    bindingMode: SheetBindingMode;
    sizeAssignments: Record<string, string>;
    slotAssignments: Record<number, string>;
  }
): SheetAdjustMeta | null {
  const slot = slots[slotIndex];
  if (!slot || !images.length) return null;

  const slotImage = resolveSlotImage({
    slot,
    slotIndex,
    images,
    mode: options.bindingMode,
    sizeAssignments: options.sizeAssignments,
    slotAssignments: options.slotAssignments,
    slots,
  });

  const sizeKey = getSlotSizeKey(slot);

  return {
    slotIndex,
    filename: slotImage.filename,
    sizeKey,
    label: getPhotoSizePreset(sizeKey).label,
  };
}

export function resolveSlotTransformTargets(
  indices: number[],
  slots: SlotRect[],
  images: ImageData[],
  options: {
    bindingMode: SheetBindingMode;
    sizeAssignments: Record<string, string>;
    slotAssignments: Record<number, string>;
  }
) {
  const targets = [];

  for (const slotIndex of indices) {
    const meta = buildAdjustMetaForSlot(slotIndex, slots, images, options);
    if (!meta) continue;
    targets.push({
      slotIndex: meta.slotIndex,
      filename: meta.filename,
      sizeKey: meta.sizeKey,
    });
  }

  return targets;
}
