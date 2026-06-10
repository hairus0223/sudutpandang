"use client";

import { useEffect, useMemo, useState } from "react";
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import type { SheetBindingMode } from "@/lib/sheetSlotBinding";
import { PHOTO_SIZE_PRESETS } from "@/lib/photoSizes";
import { getPaperPreset, PAPER_PRESETS } from "@/lib/paperSizes";
import {
  cloneRecipe,
  countRecipeSlots,
  createEmptyRow,
  createSheetItemId,
  getUniqueSizeEntries,
  resolveRowItemPhoto,
  SHEET_RECIPE_PRESETS,
  type SheetRecipe,
  type SheetRow,
  type SheetRowItem,
  withRecipePaper,
} from "@/lib/sheetRecipe";
import {
  deleteSavedSheetRecipe,
  loadSavedSheetRecipes,
  saveSheetRecipeTemplate,
  type SavedSheetRecipe,
} from "@/lib/sheetRecipeStorage";
import {
  autoRepackRecipe,
  countMaxInRow,
  mmToPx,
  validateSheetRecipe,
} from "@/utils/sheetLayoutEngine";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

function mmFromPaper(paperId: string, px: number): number {
  const dpi = getPaperPreset(paperId).dpi;
  return Math.round((px / dpi) * 25.4);
}

const BINDING_MODES: { id: SheetBindingMode; label: string }[] = [
  { id: "cycle", label: "Bergilir" },
  { id: "by-size", label: "Per ukuran" },
  { id: "manual", label: "Manual" },
];

export function SheetRecipeComposer({ images }: { images: ImageData[] }) {
  const {
    sheetRecipe,
    setSheetRecipe,
    sheetAlign,
    setSheetAlign,
    sheetCopies,
    setSheetCopies,
    showCutLines,
    setShowCutLines,
    sheetBindingMode,
    setSheetBindingMode,
    sheetSizeAssignments,
    setSheetSizeAssignment,
    sheetAssignImageFilename,
    setSheetAssignImageFilename,
  } = useGalleryStore();

  const [savedTemplates, setSavedTemplates] = useState<SavedSheetRecipe[]>([]);

  useEffect(() => {
    setSavedTemplates(loadSavedSheetRecipes());
  }, []);

  const paper = getPaperPreset(sheetRecipe.paperId);
  const validation = useMemo(
    () => validateSheetRecipe(sheetRecipe, paper),
    [sheetRecipe, paper]
  );
  const slotCount = countRecipeSlots(sheetRecipe);
  const canPrint = validation.rows.every((r) => r.fits) && validation.fitsVertically;
  const uniqueSizes = useMemo(
    () => getUniqueSizeEntries(sheetRecipe),
    [sheetRecipe]
  );

  const updateRecipe = (updater: (prev: SheetRecipe) => SheetRecipe) => {
    setSheetRecipe(updater(sheetRecipe));
  };

  const handlePaperChange = (paperId: string) => {
    updateRecipe((prev) => withRecipePaper(prev, paperId));
  };

  const applyPreset = (preset: SheetRecipe) => {
    setSheetRecipe(cloneRecipe(preset));
  };

  const updateItem = (
    rowId: string,
    itemId: string,
    patch: Partial<SheetRowItem>
  ) => {
    updateRecipe((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id !== rowId
          ? row
          : {
              ...row,
              items: row.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
              ),
            }
      ),
    }));
  };

  const addItemToRow = (rowId: string) => {
    updateRecipe((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id !== rowId
          ? row
          : {
              ...row,
              items: [
                ...row.items,
                { id: createSheetItemId(), photoSizeId: "3x4", count: 1 },
              ],
            }
      ),
    }));
  };

  const removeItem = (rowId: string, itemId: string) => {
    updateRecipe((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => {
        if (row.id !== rowId) return row;
        const items = row.items.filter((item) => item.id !== itemId);
        return { ...row, items: items.length ? items : row.items };
      }),
    }));
  };

  const addRow = () => {
    updateRecipe((prev) => ({
      ...prev,
      rows: [...prev.rows, createEmptyRow()],
    }));
  };

  const removeRow = (rowId: string) => {
    updateRecipe((prev) => ({
      ...prev,
      rows:
        prev.rows.length <= 1
          ? prev.rows
          : prev.rows.filter((row) => row.id !== rowId),
    }));
  };

  const handleAutoPack = () => {
    setSheetRecipe(autoRepackRecipe(sheetRecipe));
  };

  const handleSaveTemplate = () => {
    const label = window.prompt("Nama template layout:", sheetRecipe.label);
    if (label === null) return;
    const saved = saveSheetRecipeTemplate(sheetRecipe, label);
    setSavedTemplates(loadSavedSheetRecipes());
    setSheetRecipe(cloneRecipe(saved));
  };

  const handleDeleteTemplate = (id: string) => {
    deleteSavedSheetRecipe(id);
    setSavedTemplates(loadSavedSheetRecipes());
  };

  const maxFillItem = (row: SheetRow, item: SheetRowItem) => {
    const photo = resolveRowItemPhoto(item);
    const cutGapPx = mmToPx(sheetRecipe.cutGapMm, paper.dpi);
    const printableW = validation.rows[0]?.maxWidthPx ?? 0;
    const others: SheetRow = {
      ...row,
      items: row.items.filter((i) => i.id !== item.id),
    };
    const maxCount = countMaxInRow(
      printableW,
      photo,
      cutGapPx,
      paper.dpi,
      others.items.length ? others : undefined
    );

    if (maxCount > 0) {
      updateItem(row.id, item.id, { count: maxCount });
    }
  };

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-white/70">Kertas:</span>
        {PAPER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePaperChange(p.id)}
            className={cn(
              "rounded px-2 py-1 text-xs transition",
              sheetRecipe.paperId === p.id
                ? "bg-violet-600 text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleAutoPack}
          className="rounded bg-white/15 px-2 py-1 text-[11px] text-white hover:bg-white/25"
        >
          Auto-pack baris
        </button>
        <button
          type="button"
          onClick={handleSaveTemplate}
          className="rounded bg-white/15 px-2 py-1 text-[11px] text-white hover:bg-white/25"
        >
          Simpan template
        </button>
      </div>

      {savedTemplates.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {savedTemplates.map((template) => (
            <div key={template.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSheetRecipe(cloneRecipe(template))}
                className="rounded bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
              >
                {template.label}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(template.id)}
                className="rounded px-1 text-[10px] text-white/40 hover:text-red-300"
                title="Hapus template"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {SHEET_RECIPE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className={cn(
              "rounded px-2 py-1 text-[11px] sm:text-xs transition",
              sheetRecipe.id === preset.id
                ? "bg-green-600 text-white"
                : "bg-white/10 hover:bg-white/20"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
        {sheetRecipe.rows.map((row, rowIndex) => {
          const rowValidation = validation.rows[rowIndex];
          const rowFits = rowValidation?.fits ?? true;

          return (
            <div
              key={row.id}
              className={cn(
                "rounded border p-2",
                rowFits ? "border-white/10" : "border-red-500/60 bg-red-500/10"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white/80">
                  Baris {rowIndex + 1}
                </span>
                <div className="flex items-center gap-2">
                  {rowValidation && (
                    <span
                      className={cn(
                        "text-[10px]",
                        rowFits ? "text-white/50" : "text-red-300"
                      )}
                    >
                      {mmFromPaper(sheetRecipe.paperId, rowValidation.widthPx)} /{" "}
                      {mmFromPaper(sheetRecipe.paperId, rowValidation.maxWidthPx)} mm
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-red-300"
                    title="Hapus baris"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {row.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <select
                      value={item.photoSizeId}
                      onChange={(e) =>
                        updateItem(row.id, item.id, {
                          photoSizeId: e.target.value,
                          customMm: undefined,
                        })
                      }
                      className="rounded bg-white/10 px-2 py-1 text-white"
                    >
                      {PHOTO_SIZE_PRESETS.map((photo) => (
                        <option key={photo.id} value={photo.id}>
                          {photo.label}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-1 text-white/70">
                      qty
                      <input
                        type="number"
                        min={1}
                        max={32}
                        value={item.count}
                        onChange={(e) =>
                          updateItem(row.id, item.id, {
                            count: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-12 rounded bg-white/10 px-1 py-0.5 text-center text-white"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => maxFillItem(row, item)}
                      className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20"
                    >
                      Muat maks
                    </button>

                    {row.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(row.id, item.id)}
                        className="rounded p-1 text-white/40 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addItemToRow(row.id)}
                  className="flex items-center gap-1 self-start rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
                >
                  <Plus className="h-3 w-3" />
                  Ukuran
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addRow}
          className="flex items-center justify-center gap-1 rounded border border-dashed border-white/20 py-2 text-xs text-white/60 hover:border-white/40 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah baris
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
        <span>Foto ke slot:</span>
        {BINDING_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setSheetBindingMode(mode.id)}
            className={cn(
              "rounded px-2 py-1 transition",
              sheetBindingMode === mode.id
                ? "bg-violet-600 text-white"
                : "bg-white/10 hover:bg-white/20"
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {sheetBindingMode === "by-size" && images.length > 0 && (
        <div className="flex flex-col gap-2 rounded border border-white/10 bg-white/5 p-2">
          {uniqueSizes.map((size) => (
            <label
              key={size.key}
              className="flex flex-wrap items-center gap-2 text-xs text-white/80"
            >
              <span className="min-w-[88px]">{size.label}</span>
              <select
                value={sheetSizeAssignments[size.key] ?? ""}
                onChange={(e) =>
                  setSheetSizeAssignment(size.key, e.target.value)
                }
                className="rounded bg-white/10 px-2 py-1 text-white"
              >
                <option value="">Bergilir otomatis</option>
                {images.map((img, index) => (
                  <option key={img.filename} value={img.filename}>
                    Foto {index + 1} · {img.filename}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {sheetBindingMode === "manual" && images.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] text-white/60">
            Pilih foto lalu klik slot di preview untuk menempatkan
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {images.map((img, index) => (
              <button
                key={img.filename}
                type="button"
                onClick={() => setSheetAssignImageFilename(img.filename)}
                className={cn(
                  "rounded px-2 py-1 text-[11px] transition",
                  sheetAssignImageFilename === img.filename
                    ? "bg-violet-600 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                Foto {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {!validation.fitsVertically && (
        <p className="text-center text-[11px] text-red-300">
          Total tinggi ({mmFromPaper(sheetRecipe.paperId, validation.totalHeightPx)} mm)
          melebihi area cetak ({mmFromPaper(sheetRecipe.paperId, validation.maxHeightPx)} mm)
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/70">
        <span>Posisi:</span>
        <button
          type="button"
          onClick={() => setSheetAlign("top-left")}
          className={cn(
            "rounded px-2 py-1 transition",
            sheetAlign === "top-left"
              ? "bg-violet-600 text-white"
              : "bg-white/10 hover:bg-white/20"
          )}
        >
          Atas (hemat)
        </button>
        <button
          type="button"
          onClick={() => setSheetAlign("center")}
          className={cn(
            "rounded px-2 py-1 transition",
            sheetAlign === "center"
              ? "bg-violet-600 text-white"
              : "bg-white/10 hover:bg-white/20"
          )}
        >
          Tengah
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/70">
        <span className={cn(!canPrint && "text-amber-300")}>
          {slotCount} slot · jarak {sheetRecipe.cutGapMm} mm
          {!canPrint && " · perbaiki layout"}
        </span>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showCutLines}
            onChange={(e) => setShowCutLines(e.target.checked)}
            className="accent-violet-500"
          />
          Garis potong
        </label>
        <label className="flex items-center gap-2">
          Salinan
          <input
            type="number"
            min={1}
            max={10}
            value={sheetCopies}
            onChange={(e) => setSheetCopies(Number(e.target.value))}
            className="w-12 rounded bg-white/10 px-1 py-0.5 text-center text-white"
          />
        </label>
      </div>
    </div>
  );
}
