import type { PhotoSizePreset } from "@/lib/photoSizes";
import type { PaperPreset } from "@/lib/paperSizes";
import type { SheetRecipe, SheetRow, SheetRowItem } from "@/lib/sheetRecipe";
import {
  createEmptyRow,
  createSheetItemId,
  createSheetRowId,
  getItemSizeKey,
  resolveRowItemPhoto,
} from "@/lib/sheetRecipe";
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
  photoSizeId?: string;
  sizeKey?: string;
  rowIndex?: number;
  itemIndex?: number;
};

export type SheetGridAlign = "top-left" | "center";

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

export type RowValidation = {
  rowIndex: number;
  widthPx: number;
  maxWidthPx: number;
  heightPx: number;
  fits: boolean;
};

export type RecipeValidation = {
  rows: RowValidation[];
  totalHeightPx: number;
  maxHeightPx: number;
  fitsVertically: boolean;
  slotCount: number;
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
    width: mmToPx(photo.widthMm, dpi),
    height: mmToPx(photo.heightMm, dpi),
  };
}

function resolveGridOffset(
  printableX: number,
  printableY: number,
  printableW: number,
  printableH: number,
  gridW: number,
  gridH: number,
  align: SheetGridAlign
) {
  if (align === "center") {
    return {
      offsetX: printableX + Math.max(0, (printableW - gridW) / 2),
      offsetY: printableY + Math.max(0, (printableH - gridH) / 2),
    };
  }

  return {
    offsetX: printableX,
    offsetY: printableY,
  };
}

/**
 * Compute slot rectangles for a uniform sheet grid preset.
 * Default alignment is top-left so unused paper stays at the bottom.
 */
export function getSheetLayoutGeometry(
  layout: SheetLayoutPreset,
  paper: PaperPreset = getPaperPreset(layout.paperId),
  photo?: PhotoSizePreset,
  align: SheetGridAlign = "top-left"
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

  const { offsetX, offsetY } = resolveGridOffset(
    printableX,
    printableY,
    printableW,
    printableH,
    gridW,
    gridH,
    align
  );

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

function getPrintableArea(paper: PaperPreset) {
  const dpi = paper.dpi;
  const paperPx = getPaperDimensionsPx(paper);
  const marginTop = mmToPx(paper.marginMm.top, dpi);
  const marginRight = mmToPx(paper.marginMm.right, dpi);
  const marginBottom = mmToPx(paper.marginMm.bottom, dpi);
  const marginLeft = mmToPx(paper.marginMm.left, dpi);

  return {
    dpi,
    paperPx,
    printableX: marginLeft,
    printableY: marginTop,
    printableW: paperPx.width - marginLeft - marginRight,
    printableH: paperPx.height - marginTop - marginBottom,
  };
}

export function measureRowWidthPx(
  row: SheetRow,
  cutGapPx: number,
  dpi: number
): number {
  let width = 0;
  let slotCount = 0;

  for (const item of row.items) {
    const photo = resolveRowItemPhoto(item);
    const photoPx = getPhotoDimensionsPx(photo, dpi);
    const count = Math.max(0, item.count);

    width += count * photoPx.width;
    slotCount += count;
  }

  if (slotCount > 1) {
    width += (slotCount - 1) * cutGapPx;
  }

  return width;
}

export function measureRowHeightPx(row: SheetRow, dpi: number): number {
  let maxH = 0;

  for (const item of row.items) {
    const photo = resolveRowItemPhoto(item);
    const photoPx = getPhotoDimensionsPx(photo, dpi);
    maxH = Math.max(maxH, photoPx.height);
  }

  return maxH;
}

export function countMaxInRow(
  printableWidthPx: number,
  photo: PhotoSizePreset,
  cutGapPx: number,
  dpi: number,
  existingRow?: SheetRow
): number {
  const photoPx = getPhotoDimensionsPx(photo, dpi);
  let usedWidth = 0;

  if (existingRow) {
    usedWidth = measureRowWidthPx(existingRow, cutGapPx, dpi);
    if (usedWidth > 0) usedWidth += cutGapPx;
  }

  const available = printableWidthPx - usedWidth;
  if (available < photoPx.width) return 0;

  return countMaxCols(available, photoPx.width, cutGapPx);
}

export function validateSheetRecipe(
  recipe: SheetRecipe,
  paper: PaperPreset = getPaperPreset(recipe.paperId)
): RecipeValidation {
  const { dpi, printableW, printableH } = getPrintableArea(paper);
  const cutGapPx = mmToPx(recipe.cutGapMm, dpi);
  const rowGapPx = mmToPx(recipe.rowGapMm, dpi);

  const rows: RowValidation[] = [];
  let totalHeight = 0;
  let slotCount = 0;

  recipe.rows.forEach((row, rowIndex) => {
    const widthPx = measureRowWidthPx(row, cutGapPx, dpi);
    const heightPx = measureRowHeightPx(row, dpi);
    const rowSlots = row.items.reduce((sum, item) => sum + Math.max(0, item.count), 0);

    rows.push({
      rowIndex,
      widthPx,
      maxWidthPx: printableW,
      heightPx,
      fits: widthPx <= printableW,
    });

    slotCount += rowSlots;
    totalHeight += heightPx;
    if (rowIndex < recipe.rows.length - 1) {
      totalHeight += rowGapPx;
    }
  });

  return {
    rows,
    totalHeightPx: totalHeight,
    maxHeightPx: printableH,
    fitsVertically: totalHeight <= printableH,
    slotCount,
  };
}

/**
 * Pack a flexible sheet recipe into slot rectangles (mixed sizes per row).
 */
export function packSheetRecipe(
  recipe: SheetRecipe,
  paper: PaperPreset = getPaperPreset(recipe.paperId),
  align: SheetGridAlign = "top-left"
): SheetLayoutGeometry {
  const { dpi, paperPx, printableX, printableY, printableW, printableH } =
    getPrintableArea(paper);
  const cutGapPx = mmToPx(recipe.cutGapMm, dpi);
  const rowGapPx = mmToPx(recipe.rowGapMm, dpi);

  const rowMetrics = recipe.rows.map((row) => ({
    row,
    widthPx: measureRowWidthPx(row, cutGapPx, dpi),
    heightPx: measureRowHeightPx(row, dpi),
  }));

  const blockW = Math.max(...rowMetrics.map((m) => m.widthPx), 0);
  const blockH =
    rowMetrics.reduce((sum, m) => sum + m.heightPx, 0) +
    Math.max(0, recipe.rows.length - 1) * rowGapPx;

  const blockOffset = resolveGridOffset(
    printableX,
    printableY,
    printableW,
    printableH,
    blockW,
    blockH,
    align
  );

  const slots: SlotRect[] = [];
  let slotIndex = 0;
  let y = blockOffset.offsetY;

  rowMetrics.forEach(({ row, widthPx, heightPx }, rowIndex) => {
    const rowStartX =
      align === "center"
        ? printableX + Math.max(0, (printableW - widthPx) / 2)
        : blockOffset.offsetX;

    let x = rowStartX;
    let colInRow = 0;

    row.items.forEach((item, itemIndex) => {
      const photo = resolveRowItemPhoto(item);
      const photoPx = getPhotoDimensionsPx(photo, dpi);
      const count = Math.max(0, item.count);

      for (let i = 0; i < count; i += 1) {
        slots.push({
          index: slotIndex,
          col: colInRow,
          row: rowIndex,
          x,
          y,
          w: photoPx.width,
          h: photoPx.height,
          photoSizeId: item.photoSizeId,
          sizeKey: getItemSizeKey(item),
          rowIndex,
          itemIndex,
        });

        slotIndex += 1;
        colInRow += 1;
        x += photoPx.width + cutGapPx;
      }
    });

    y += heightPx + rowGapPx;
  });

  const firstSlot = slots[0];

  return {
    paperWidthPx: paperPx.width,
    paperHeightPx: paperPx.height,
    printableArea: {
      x: printableX,
      y: printableY,
      w: printableW,
      h: printableH,
    },
    photoWidthPx: firstSlot?.w ?? 0,
    photoHeightPx: firstSlot?.h ?? 0,
    cutGapPx,
    slots,
  };
}

export type AutoPackDemand = {
  photoSizeId: string;
  customMm?: { widthMm: number; heightMm: number };
  count: number;
};

/**
 * Greedy row packer: flatten size demands into rows that fit printable width.
 */
export function autoPackToRecipe(
  paperId: string,
  demands: AutoPackDemand[],
  cutGapMm = 2,
  rowGapMm = 2
): SheetRecipe {
  const paper = getPaperPreset(paperId);
  const { dpi, printableW } = getPrintableArea(paper);
  const cutGapPx = mmToPx(cutGapMm, dpi);

  type Piece = {
    item: SheetRowItem;
    widthPx: number;
    heightPx: number;
  };

  const pieces: Piece[] = [];

  for (const demand of demands) {
    const baseItem: SheetRowItem = {
      id: createSheetItemId(),
      photoSizeId: demand.photoSizeId,
      customMm: demand.customMm,
      count: 1,
    };
    const photo = resolveRowItemPhoto(baseItem);
    const photoPx = getPhotoDimensionsPx(photo, dpi);

    for (let i = 0; i < Math.max(0, demand.count); i += 1) {
      pieces.push({
        item: { ...baseItem, id: createSheetItemId() },
        widthPx: photoPx.width,
        heightPx: photoPx.height,
      });
    }
  }

  pieces.sort((a, b) => b.heightPx - a.heightPx || b.widthPx - a.widthPx);

  const rows: SheetRow[] = [];
  let currentRow: SheetRow = { id: createSheetRowId(), items: [] };
  let currentRowWidth = 0;
  let currentRowHeight = 0;

  const flushRow = () => {
    if (!currentRow.items.length) return;
    rows.push(currentRow);
    currentRow = { id: createSheetRowId(), items: [] };
    currentRowWidth = 0;
    currentRowHeight = 0;
  };

  const appendPiece = (piece: Piece) => {
    const last = currentRow.items[currentRow.items.length - 1];
    const sameSize =
      last &&
      getItemSizeKey(last) === getItemSizeKey(piece.item) &&
      JSON.stringify(last.customMm) === JSON.stringify(piece.item.customMm);

    if (sameSize) {
      last.count += 1;
    } else {
      currentRow.items.push({ ...piece.item, count: 1 });
    }

    currentRowWidth +=
      piece.widthPx + (currentRowWidth > 0 ? cutGapPx : 0);
    currentRowHeight = Math.max(currentRowHeight, piece.heightPx);
  };

  for (const piece of pieces) {
    const gap = currentRowWidth > 0 ? cutGapPx : 0;
    if (currentRowWidth > 0 && currentRowWidth + gap + piece.widthPx > printableW) {
      flushRow();
    }

    if (piece.widthPx > printableW) {
      if (currentRow.items.length) flushRow();
    }

    appendPiece(piece);
  }

  flushRow();

  return {
    id: `auto_${Date.now()}`,
    label: "Auto-pack",
    paperId,
    cutGapMm,
    rowGapMm,
    rows: rows.length ? rows : [createEmptyRow()],
  };
}

export function autoRepackRecipe(recipe: SheetRecipe): SheetRecipe {
  const demands: AutoPackDemand[] = [];

  for (const row of recipe.rows) {
    for (const item of row.items) {
      if (item.count > 0) {
        demands.push({
          photoSizeId: item.photoSizeId,
          customMm: item.customMm,
          count: item.count,
        });
      }
    }
  }

  const packed = autoPackToRecipe(
    recipe.paperId,
    demands,
    recipe.cutGapMm,
    recipe.rowGapMm
  );

  return {
    ...packed,
    id: `auto_${recipe.id}`,
    label: `${recipe.label} · auto-pack`,
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
