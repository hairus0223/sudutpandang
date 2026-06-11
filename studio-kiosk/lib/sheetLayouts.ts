import type { PhotoSizePreset } from "@/lib/photoSizes";
import { CUSTOM_PHOTO_SIZE_ID, getPhotoSizePreset } from "@/lib/photoSizes";
import type { PaperPreset } from "@/lib/paperSizes";
import { getPaperPreset } from "@/lib/paperSizes";

export type SheetLayoutPreset = {
  id: string;
  label: string;
  paperId: string;
  photoSizeId: string;
  cols: number;
  rows: number;
  cutGapMm: number;
};

export const SHEET_LAYOUT_PRESETS: SheetLayoutPreset[] = [
  {
    id: "A4_2x3_x24",
    label: "A4 · 2×3 cm · 24 foto",
    paperId: "A4",
    photoSizeId: "2x3",
    cols: 4,
    rows: 6,
    cutGapMm: 2,
  },
  {
    id: "A4_3x4_x8",
    label: "A4 · 3×4 cm · 8 foto",
    paperId: "A4",
    photoSizeId: "3x4",
    cols: 2,
    rows: 4,
    cutGapMm: 2,
  },
  {
    id: "A4_4x6_x8",
    label: "A4 · 4×6 cm · 8 foto",
    paperId: "A4",
    photoSizeId: "4x6",
    cols: 2,
    rows: 4,
    cutGapMm: 2,
  },
  {
    id: "A4_10x15_x2",
    label: "A4 · 10×15 cm · 2 foto",
    paperId: "A4",
    photoSizeId: "10x15",
    cols: 1,
    rows: 2,
    cutGapMm: 2,
  },
  {
    id: "Letter_2x3_x24",
    label: "Letter · 2×3 cm · 24 foto",
    paperId: "Letter",
    photoSizeId: "2x3",
    cols: 4,
    rows: 6,
    cutGapMm: 2,
  },
  {
    id: "Letter_3x4_x8",
    label: "Letter · 3×4 cm · 8 foto",
    paperId: "Letter",
    photoSizeId: "3x4",
    cols: 2,
    rows: 4,
    cutGapMm: 2,
  },
  {
    id: "Letter_4x6_x8",
    label: "Letter · 4×6 cm · 8 foto",
    paperId: "Letter",
    photoSizeId: "4x6",
    cols: 2,
    rows: 4,
    cutGapMm: 2,
  },
];

export const DEFAULT_SHEET_LAYOUT_ID = "A4_3x4_x8";

export function getSheetLayoutPreset(id: string): SheetLayoutPreset {
  return (
    SHEET_LAYOUT_PRESETS.find((preset) => preset.id === id) ??
    SHEET_LAYOUT_PRESETS.find((preset) => preset.id === DEFAULT_SHEET_LAYOUT_ID) ??
    SHEET_LAYOUT_PRESETS[0]
  );
}

export function createSheetLayout(params: {
  paperId: string;
  photoSizeId: string;
  cols: number;
  rows: number;
  cutGapMm?: number;
  label?: string;
  photo?: PhotoSizePreset;
}): SheetLayoutPreset {
  const paper = getPaperPreset(params.paperId);
  const photo = params.photo ?? getPhotoSizePreset(params.photoSizeId);
  const slotCount = params.cols * params.rows;

  return {
    id: `dynamic_${params.paperId}_${params.photoSizeId}_${params.cols}x${params.rows}`,
    label:
      params.label ??
      `${paper.label} · ${photo.label} · ${slotCount} foto`,
    paperId: params.paperId,
    photoSizeId: params.photoSizeId,
    cols: params.cols,
    rows: params.rows,
    cutGapMm: params.cutGapMm ?? 2,
  };
}

export function resolvePhotoForLayout(
  layout: SheetLayoutPreset,
  customPhoto: PhotoSizePreset | null
): PhotoSizePreset {
  if (layout.photoSizeId === CUSTOM_PHOTO_SIZE_ID && customPhoto) {
    return customPhoto;
  }

  return getPhotoSizePreset(layout.photoSizeId);
}

export function resolveSheetLayoutContext(
  layout: SheetLayoutPreset,
  customPhoto: PhotoSizePreset | null = null
): {
  layout: SheetLayoutPreset;
  paper: PaperPreset;
  photo: PhotoSizePreset;
  slotCount: number;
} {
  const paper = getPaperPreset(layout.paperId);
  const photo = resolvePhotoForLayout(layout, customPhoto);

  return {
    layout,
    paper,
    photo,
    slotCount: layout.cols * layout.rows,
  };
}

export function getLayoutsForPaperAndPhoto(
  paperId: string,
  photoSizeId: string
): SheetLayoutPreset[] {
  return SHEET_LAYOUT_PRESETS.filter(
    (preset) =>
      preset.paperId === paperId &&
      preset.photoSizeId === photoSizeId &&
      preset.photoSizeId !== CUSTOM_PHOTO_SIZE_ID
  );
}

export function getLayoutsForPhotoSize(photoSizeId: string): SheetLayoutPreset[] {
  return SHEET_LAYOUT_PRESETS.filter(
    (preset) => preset.photoSizeId === photoSizeId
  );
}

export function getDefaultLayoutForPaperAndPhoto(
  paperId: string,
  photoSizeId: string
): SheetLayoutPreset | null {
  const matches = getLayoutsForPaperAndPhoto(paperId, photoSizeId);
  return matches[0] ?? null;
}
