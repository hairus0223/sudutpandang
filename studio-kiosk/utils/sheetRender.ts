import type { SheetSlotDraw } from "@/components/print/canvas/drawSheetLayout";
import type { ImageData, PhotoTransform } from "@/stores/useGalleryStore";
import type { SheetBindingMode } from "@/lib/sheetSlotBinding";
import { resolveSlotImage } from "@/lib/sheetSlotBinding";
import type { FaceBox } from "@/utils/faceDetect";
import type { SheetLayoutGeometry } from "@/utils/sheetLayoutEngine";

export function buildSheetSlotDraws({
  geometry,
  images,
  loaded,
  bindingMode,
  sizeAssignments,
  slotAssignments,
  photoTransforms,
  sheetSlotTransforms,
  faceBoxes,
}: {
  geometry: SheetLayoutGeometry;
  images: ImageData[];
  loaded: { filename: string; img: HTMLImageElement }[];
  bindingMode: SheetBindingMode;
  sizeAssignments: Record<string, string>;
  slotAssignments: Record<number, string>;
  photoTransforms: Record<string, PhotoTransform>;
  sheetSlotTransforms: Record<number, PhotoTransform>;
  faceBoxes: Record<string, FaceBox[]>;
}): SheetSlotDraw[] {
  return geometry.slots.map((slot) => {
    const imgData = resolveSlotImage({
      slot,
      slotIndex: slot.index,
      images,
      mode: bindingMode,
      sizeAssignments,
      slotAssignments,
      slots: geometry.slots,
    });

    const cached = loaded.find((entry) => entry.filename === imgData.filename);

    return {
      image: cached?.img as HTMLImageElement,
      transform: {
        ...photoTransforms[imgData.filename],
        ...sheetSlotTransforms[slot.index],
      },
      faceBoxes: faceBoxes[imgData.filename] ?? [],
    };
  });
}
