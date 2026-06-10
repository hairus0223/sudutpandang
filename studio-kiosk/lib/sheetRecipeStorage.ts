import type { SheetRecipe } from "@/lib/sheetRecipe";
import { cloneRecipe, createSheetRowId } from "@/lib/sheetRecipe";

const STORAGE_KEY = "sudutpandang_sheet_recipe_templates";

export type SavedSheetRecipe = SheetRecipe & {
  savedAt: number;
};

function readAll(): SavedSheetRecipe[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSheetRecipe[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(templates: SavedSheetRecipe[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function loadSavedSheetRecipes(): SavedSheetRecipe[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveSheetRecipeTemplate(
  recipe: SheetRecipe,
  label?: string
): SavedSheetRecipe {
  const saved: SavedSheetRecipe = {
    ...cloneRecipe(recipe),
    id: `saved_${createSheetRowId()}`,
    label: label?.trim() || recipe.label || "Layout tersimpan",
    savedAt: Date.now(),
  };

  const templates = readAll();
  templates.unshift(saved);
  writeAll(templates.slice(0, 20));
  return saved;
}

export function deleteSavedSheetRecipe(id: string) {
  writeAll(readAll().filter((template) => template.id !== id));
}
