"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cloneRecipe,
  type SheetRecipe,
} from "@/lib/sheetRecipe";
import {
  deleteSavedSheetRecipe,
  loadSavedSheetRecipes,
  saveSheetRecipeTemplate,
  type SavedSheetRecipe,
} from "@/lib/sheetRecipeStorage";
import { cn } from "@/lib/utils";

type SavedTemplatesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: SheetRecipe;
  onApply: (recipe: SheetRecipe) => void;
};

export function SavedTemplatesDialog({
  open,
  onOpenChange,
  recipe,
  onApply,
}: SavedTemplatesDialogProps) {
  const [templates, setTemplates] = useState<SavedSheetRecipe[]>([]);
  const [saveName, setSaveName] = useState(recipe.label);

  useEffect(() => {
    if (open) {
      setTemplates(loadSavedSheetRecipes());
      setSaveName(recipe.label);
    }
  }, [open, recipe.label]);

  const refresh = () => setTemplates(loadSavedSheetRecipes());

  const handleSave = () => {
    const label = saveName.trim() || recipe.label;
    const saved = saveSheetRecipeTemplate(recipe, label);
    refresh();
    onApply(cloneRecipe(saved));
  };

  const handleDelete = (id: string) => {
    deleteSavedSheetRecipe(id);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-neutral-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Template layout</DialogTitle>
          <DialogDescription className="text-white/55">
            Simpan atau muat konfigurasi baris dan ukuran foto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white/70">Simpan layout saat ini</label>
            <div className="flex gap-2">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="border-white/15 bg-white/5 text-white"
                placeholder="Nama template"
              />
              <Button
                type="button"
                onClick={handleSave}
                className="shrink-0 bg-violet-600 hover:bg-violet-500"
              >
                Simpan
              </Button>
            </div>
          </div>

          {templates.length > 0 ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center gap-1 rounded-md hover:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onApply(cloneRecipe(template));
                      onOpenChange(false);
                    }}
                    className={cn(
                      "min-h-[40px] flex-1 px-3 py-2 text-left text-sm text-white/90"
                    )}
                  >
                    {template.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    className="rounded p-2 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                    title="Hapus template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-white/45 py-4">
              Belum ada template tersimpan.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/15 bg-transparent text-white hover:bg-white/10"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
