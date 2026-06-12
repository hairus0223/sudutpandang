import type { PhotoTransform } from "@/stores/useGalleryStore";

export type SlotSelectionModifiers = {
  shiftKey?: boolean;
  additive?: boolean;
};

export function nextSlotSelection(
  current: number[],
  clickedIndex: number,
  anchorIndex: number | null,
  totalSlots: number,
  { shiftKey = false, additive = false }: SlotSelectionModifiers
): number[] {
  if (clickedIndex < 0 || clickedIndex >= totalSlots) return current;

  if (shiftKey && anchorIndex !== null) {
    const start = Math.min(anchorIndex, clickedIndex);
    const end = Math.max(anchorIndex, clickedIndex);
    const range: number[] = [];
    for (let i = start; i <= end; i += 1) range.push(i);
    if (additive) {
      return [...new Set([...current, ...range])].sort((a, b) => a - b);
    }
    return range;
  }

  if (additive) {
    if (current.includes(clickedIndex)) {
      const next = current.filter((i) => i !== clickedIndex);
      return next.length > 0 ? next : [clickedIndex];
    }
    return [...current, clickedIndex].sort((a, b) => a - b);
  }

  return [clickedIndex];
}

export type SlotTransformTarget = {
  slotIndex: number;
  filename: string;
  sizeKey: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

export function batchAdjustZoom(
  targets: SlotTransformTarget[],
  delta: number,
  getTransform: (
    filename: string,
    sizeKey: string,
    slotIndex: number
  ) => PhotoTransform,
  setTransform: (
    filename: string,
    sizeKey: string,
    slotIndex: number,
    patch: Partial<PhotoTransform>
  ) => void
) {
  for (const target of targets) {
    const current = getTransform(
      target.filename,
      target.sizeKey,
      target.slotIndex
    );
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, current.scale + delta)
    );
    setTransform(target.filename, target.sizeKey, target.slotIndex, {
      scale: nextScale,
    });
  }
}

export function batchNudge(
  targets: SlotTransformTarget[],
  dx: number,
  dy: number,
  getTransform: (
    filename: string,
    sizeKey: string,
    slotIndex: number
  ) => PhotoTransform,
  setTransform: (
    filename: string,
    sizeKey: string,
    slotIndex: number,
    patch: Partial<PhotoTransform>
  ) => void
) {
  for (const target of targets) {
    const current = getTransform(
      target.filename,
      target.sizeKey,
      target.slotIndex
    );
    setTransform(target.filename, target.sizeKey, target.slotIndex, {
      offsetX: current.offsetX + dx,
      offsetY: current.offsetY + dy,
    });
  }
}

export function batchResetTransforms(
  targets: SlotTransformTarget[],
  resetTransform: (
    filename: string,
    sizeKey: string,
    slotIndex: number
  ) => void
) {
  for (const target of targets) {
    resetTransform(target.filename, target.sizeKey, target.slotIndex);
  }
}

export function pruneSlotIndices(indices: number[], slotCount: number): number[] {
  return [...new Set(indices.filter((i) => i >= 0 && i < slotCount))].sort(
    (a, b) => a - b
  );
}
