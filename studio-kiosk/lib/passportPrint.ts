import {
  DEFAULT_PASSPORT_SIZE_ID,
  getPhotoSizePreset,
} from "@/lib/photoSizes";
import type { PackageType } from "@/lib/imageTypes";
import { getSheetLayoutPreset } from "@/lib/sheetLayouts";
import { recipeFromUniformLayout, type SheetRecipe } from "@/lib/sheetRecipe";
import type { PrintMode } from "@/stores/useGalleryStore";

const PASSPORT_SIZE_TO_LAYOUT: Record<string, string> = {
  "2x3": "A4_2x3_x24",
  "3x4": "A4_3x4_x8",
  "4x6": "A4_4x6_x8",
};

export function getSheetRecipeForPassportSize(
  sizeId: string = DEFAULT_PASSPORT_SIZE_ID
): SheetRecipe {
  const layoutId =
    PASSPORT_SIZE_TO_LAYOUT[sizeId] ?? PASSPORT_SIZE_TO_LAYOUT[DEFAULT_PASSPORT_SIZE_ID];
  return recipeFromUniformLayout(getSheetLayoutPreset(layoutId));
}

export function configurePasPhotoPrintDefaults({
  packageType,
  passportSizeId,
  setPrintMode,
  setSheetRecipe,
}: {
  packageType: PackageType;
  passportSizeId?: string;
  setPrintMode: (mode: PrintMode) => void;
  setSheetRecipe: (recipe: SheetRecipe) => void;
}) {
  if (packageType !== "pas-photo") return;

  const resolvedSizeId = passportSizeId ?? DEFAULT_PASSPORT_SIZE_ID;
  setPrintMode("sheet");
  setSheetRecipe(getSheetRecipeForPassportSize(resolvedSizeId));
}

export function getPassportSizeLabel(sizeId: string): string {
  return getPhotoSizePreset(sizeId).label;
}
