import type { PhotoSizePreset } from "@/lib/photoSizes";
import {
  CUSTOM_PHOTO_SIZE_ID,
  createPhotoSizeFromMm,
  getPhotoSizePreset,
} from "@/lib/photoSizes";
import type { SheetLayoutPreset } from "@/lib/sheetLayouts";
import { getSheetLayoutPreset } from "@/lib/sheetLayouts";
export type SheetRowItem = {
  id: string;
  photoSizeId: string;
  customMm?: { widthMm: number; heightMm: number };
  count: number;
};

export type SheetRow = {
  id: string;
  items: SheetRowItem[];
};

export type SheetRecipe = {
  id: string;
  label: string;
  paperId: string;
  cutGapMm: number;
  rowGapMm: number;
  rows: SheetRow[];
};

export function createSheetItemId(): string {
  return `item_${Math.random().toString(36).slice(2, 9)}`;
}

export function createSheetRowId(): string {
  return `row_${Math.random().toString(36).slice(2, 9)}`;
}

export function getItemSizeKey(item: SheetRowItem): string {
  if (item.photoSizeId === CUSTOM_PHOTO_SIZE_ID && item.customMm) {
    return `custom_${item.customMm.widthMm}x${item.customMm.heightMm}`;
  }

  return item.photoSizeId;
}

export function getUniqueSizeEntries(
  recipe: SheetRecipe
): { key: string; label: string; item: SheetRowItem }[] {
  const seen = new Map<string, SheetRowItem>();

  for (const row of recipe.rows) {
    for (const item of row.items) {
      const key = getItemSizeKey(item);
      if (!seen.has(key)) seen.set(key, item);
    }
  }

  return [...seen.entries()].map(([key, item]) => ({
    key,
    label: resolveRowItemPhoto(item).label,
    item,
  }));
}

export function resolveRowItemPhoto(item: SheetRowItem): PhotoSizePreset {
  if (item.photoSizeId === CUSTOM_PHOTO_SIZE_ID && item.customMm) {
    return createPhotoSizeFromMm(item.customMm.widthMm, item.customMm.heightMm);
  }

  return getPhotoSizePreset(item.photoSizeId);
}

export function countRecipeSlots(recipe: SheetRecipe): number {
  return recipe.rows.reduce(
    (sum, row) =>
      sum + row.items.reduce((rowSum, item) => rowSum + Math.max(0, item.count), 0),
    0
  );
}

export function recipeFromUniformLayout(layout: SheetLayoutPreset): SheetRecipe {
  const rows: SheetRow[] = Array.from({ length: layout.rows }, (_, rowIndex) => ({
    id: `row_${rowIndex}`,
    items: [
      {
        id: `item_${rowIndex}_0`,
        photoSizeId: layout.photoSizeId,
        count: layout.cols,
      },
    ],
  }));

  return {
    id: layout.id,
    label: layout.label,
    paperId: layout.paperId,
    cutGapMm: layout.cutGapMm,
    rowGapMm: layout.cutGapMm,
    rows,
  };
}

export function createDefaultSheetRecipe(): SheetRecipe {
  return recipeFromUniformLayout(getSheetLayoutPreset("A4_3x4_x8"));
}

export function createEmptyRow(): SheetRow {
  return {
    id: createSheetRowId(),
    items: [
      {
        id: createSheetItemId(),
        photoSizeId: "2x3",
        count: 1,
      },
    ],
  };
}

export const SHEET_RECIPE_PRESETS: SheetRecipe[] = [
  recipeFromUniformLayout(getSheetLayoutPreset("A4_2x3_x24")),
  recipeFromUniformLayout(getSheetLayoutPreset("A4_3x4_x8")),
  recipeFromUniformLayout(getSheetLayoutPreset("A4_4x6_x8")),
  {
    id: "A4_mixed_pas",
    label: "A4 · Pas foto campuran (3×2×3 cm + 2×3×4 cm)",
    paperId: "A4",
    cutGapMm: 2,
    rowGapMm: 2,
    rows: [
      {
        id: "row_mixed_1",
        items: [
          { id: "item_2x3", photoSizeId: "2x3", count: 3 },
          { id: "item_3x4", photoSizeId: "3x4", count: 2 },
        ],
      },
    ],
  },
  recipeFromUniformLayout(getSheetLayoutPreset("Letter_2x3_x24")),
  recipeFromUniformLayout(getSheetLayoutPreset("Letter_3x4_x8")),
];

export function getSheetRecipePreset(id: string): SheetRecipe | null {
  return SHEET_RECIPE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function cloneRecipe(recipe: SheetRecipe): SheetRecipe {
  return JSON.parse(JSON.stringify(recipe)) as SheetRecipe;
}

export function withRecipePaper(recipe: SheetRecipe, paperId: string): SheetRecipe {
  return {
    ...recipe,
    id: `${recipe.id}_${paperId}`,
    paperId,
  };
}
