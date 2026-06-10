import type { PhotoSizePreset } from "@/lib/photoSizes";
import type { PaperPreset } from "@/lib/paperSizes";
import type { SheetLayoutPreset } from "@/lib/sheetLayouts";
import { getPhotoSizePreset } from "@/lib/photoSizes";
import { getPaperPreset } from "@/lib/paperSizes";

export type SlotRect = {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SheetLayoutGeometry = {
  paperWidthPx: number;
  paperHeightPx: number;
  printableArea: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  photoWidthPx: number;
  photoHeightPx: number;
  cutGapPx: number;
  slots: SlotRect[];
};

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

export function inchToPx(inches: number, dpi: number): number {
  return Math.round(inches * dpi);
}

export function getPaperDimensionsPx(paper: PaperPreset) {
  return {
    width: mmToPx(paper.widthMm, paper.dpi),
    height: mmToPx(paper.heightMm, paper.dpi),
  };
}

export function getPhotoDimensionsPx(photo: PhotoSizePreset, dpi: number) {
  return {
    width: inchToPx(photo.widthInch, dpi),
    height: inchToPx(photo.heightInch, dpi),
  };
}

/**
 * Compute centered slot rectangles for a sheet layout preset.
 */
export function getSheetLayoutGeometry(
  layout: SheetLayoutPreset,
  paper: PaperPreset = getPaperPreset(layout.paperId),
  photo?: PhotoSizePreset
): SheetLayoutGeometry {
  const resolvedPhoto = photo ?? getPhotoSizePreset(layout.photoSizeId);
  const dpi = paper.dpi;
  const paperPx = getPaperDimensionsPx(paper);
  const photoPx = getPhotoDimensionsPx(resolvedPhoto, dpi);
  const cutGapPx = mmToPx(layout.cutGapMm, dpi);

  const marginTop = mmToPx(paper.marginMm.top, dpi);
  const marginRight = mmToPx(paper.marginMm.right, dpi);
  const marginBottom = mmToPx(paper.marginMm.bottom, dpi);
  const marginLeft = mmToPx(paper.marginMm.left, dpi);

  const printableX = marginLeft;
  const printableY = marginTop;
  const printableW = paperPx.width - marginLeft - marginRight;
  const printableH = paperPx.height - marginTop - marginBottom;

  const gridW = layout.cols * photoPx.width + (layout.cols - 1) * cutGapPx;
  const gridH = layout.rows * photoPx.height + (layout.rows - 1) * cutGapPx;

  const offsetX = printableX + Math.max(0, (printableW - gridW) / 2);
  const offsetY = printableY + Math.max(0, (printableH - gridH) / 2);

  const slots: SlotRect[] = [];

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const index = row * layout.cols + col;
      slots.push({
        index,
        col,
        row,
        x: offsetX + col * (photoPx.width + cutGapPx),
        y: offsetY + row * (photoPx.height + cutGapPx),
        w: photoPx.width,
        h: photoPx.height,
      });
    }
  }

  return {
    paperWidthPx: paperPx.width,
    paperHeightPx: paperPx.height,
    printableArea: {
      x: printableX,
      y: printableY,
      w: printableW,
      h: printableH,
    },
    photoWidthPx: photoPx.width,
    photoHeightPx: photoPx.height,
    cutGapPx,
    slots,
  };
}

export function countMaxCols(
  printableWidthPx: number,
  photoWidthPx: number,
  cutGapPx: number
): number {
  let cols = 0;
  for (let c = 1; c <= 32; c += 1) {
    const gridW = c * photoWidthPx + (c - 1) * cutGapPx;
    if (gridW <= printableWidthPx) cols = c;
    else break;
  }
  return cols;
}

export function countMaxRows(
  printableHeightPx: number,
  photoHeightPx: number,
  cutGapPx: number
): number {
  let rows = 0;
  for (let r = 1; r <= 32; r += 1) {
    const gridH = r * photoHeightPx + (r - 1) * cutGapPx;
    if (gridH <= printableHeightPx) rows = r;
    else break;
  }
  return rows;
}

/**
 * Suggest the maximum grid that fits on a paper for a given photo size.
 */
export function suggestMaxSheetLayout(
  paper: PaperPreset,
  photo: PhotoSizePreset,
  cutGapMm = 2
): { cols: number; rows: number; slotCount: number } {
  const dpi = paper.dpi;
  const paperPx = getPaperDimensionsPx(paper);
  const photoPx = getPhotoDimensionsPx(photo, dpi);
  const cutGapPx = mmToPx(cutGapMm, dpi);

  const marginTop = mmToPx(paper.marginMm.top, dpi);
  const marginRight = mmToPx(paper.marginMm.right, dpi);
  const marginBottom = mmToPx(paper.marginMm.bottom, dpi);
  const marginLeft = mmToPx(paper.marginMm.left, dpi);

  const printableW = paperPx.width - marginLeft - marginRight;
  const printableH = paperPx.height - marginTop - marginBottom;

  const cols = countMaxCols(printableW, photoPx.width, cutGapPx);
  const rows = countMaxRows(printableH, photoPx.height, cutGapPx);

  return {
    cols: Math.max(1, cols),
    rows: Math.max(1, rows),
    slotCount: Math.max(1, cols) * Math.max(1, rows),
  };
}

/** @deprecated Use getSheetLayoutGeometry */
export function getSlotRects(
  layout: SheetLayoutPreset,
  paper?: PaperPreset,
  photo?: PhotoSizePreset
): SlotRect[] {
  return getSheetLayoutGeometry(layout, paper, photo).slots;
}
