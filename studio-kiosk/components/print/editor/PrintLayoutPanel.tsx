"use client";

import { useMemo, useState } from "react";
import { FolderOpen, Plus, Trash2, Wand2 } from "lucide-react";
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import type { SheetBindingMode } from "@/lib/sheetSlotBinding";
import { PHOTO_SIZE_PRESETS } from "@/lib/photoSizes";
import {
  getPaperPreset,
  PAPER_PRESETS,
  type PaperMarginsMm,
} from "@/lib/paperSizes";
import { useResolvedSheetPaper } from "@/hooks/useResolvedSheetPaper";
import { MARGIN_MAX_MM, MARGIN_MIN_MM } from "@/lib/resolvePaper";
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
  autoRepackRecipe,
  countMaxInRow,
  mmToPx,
  validateSheetRecipe,
} from "@/utils/sheetLayoutEngine";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ChipButton,
  PanelSection,
  SegmentedControl,
  panelScrollClass,
  panelShellClass,
} from "./printEditorUi";
import { PrintModeToggle } from "./PrintModeToggle";
import { SavedTemplatesDialog } from "./SavedTemplatesDialog";

function mmFromPaper(paperId: string, px: number): number {
  const dpi = getPaperPreset(paperId).dpi;
  return Math.round((px / dpi) * 25.4);
}

const BINDING_MODES: { id: SheetBindingMode; label: string }[] = [
  { id: "cycle", label: "Bergilir" },
  { id: "by-size", label: "Per ukuran" },
  { id: "manual", label: "Manual" },
];

const MARGIN_PRESETS = [0, 5, 10, 15] as const;

export function PrintLayoutPanel({
  images,
  embedded = false,
}: {
  images: ImageData[];
  embedded?: boolean;
}) {
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
    sheetPaperMargins,
    sheetMarginUniform,
    setSheetPaperMarginSide,
    setSheetPaperMarginsUniform,
    resetSheetPaperMargins,
    setSheetMarginUniform,
  } = useGalleryStore();

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [marginAdvanced, setMarginAdvanced] = useState(!sheetMarginUniform);

  const paper = useResolvedSheetPaper();
  const validation = useMemo(
    () => validateSheetRecipe(sheetRecipe, paper),
    [sheetRecipe, paper]
  );

  const slotCount = countRecipeSlots(sheetRecipe);
  const canPrint =
    validation.rows.every((r) => r.fits) && validation.fitsVertically;
  const uniqueSizes = useMemo(
    () => getUniqueSizeEntries(sheetRecipe),
    [sheetRecipe]
  );

  const marginSides: { key: keyof PaperMarginsMm; label: string }[] = [
    { key: "top", label: "Atas" },
    { key: "right", label: "Kanan" },
    { key: "bottom", label: "Bawah" },
    { key: "left", label: "Kiri" },
  ];

  const updateRecipe = (updater: (prev: SheetRecipe) => SheetRecipe) => {
    setSheetRecipe(updater(sheetRecipe));
  };

  const handlePaperChange = (paperId: string) => {
    updateRecipe((prev) => withRecipePaper(prev, paperId));
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

  const body = (
    <div className={embedded ? "flex flex-col gap-5" : panelScrollClass}>
      <div className="flex flex-col gap-5">
          <PrintModeToggle />

          <PanelSection
            title="Template cepat"
            description="Preset layout umum"
          >
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {SHEET_RECIPE_PRESETS.map((preset) => (
                <ChipButton
                  key={preset.id}
                  active={sheetRecipe.id === preset.id}
                  onClick={() => setSheetRecipe(cloneRecipe(preset))}
                >
                  {preset.label}
                </ChipButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTemplatesOpen(true)}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Template tersimpan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSheetRecipe(autoRepackRecipe(sheetRecipe))}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Auto-pack
              </Button>
            </div>
          </PanelSection>

          <PanelSection title="Kertas">
            <SegmentedControl
              value={sheetRecipe.paperId}
              onChange={handlePaperChange}
              options={PAPER_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            />
          </PanelSection>

          <PanelSection
            title="Margin (mm)"
            description="Area abu-abu di preview = non-cetak"
          >
            <div className="flex flex-wrap gap-1">
              {MARGIN_PRESETS.map((preset) => (
                <ChipButton
                  key={preset}
                  active={
                    sheetMarginUniform && sheetPaperMargins.top === preset
                  }
                  onClick={() => setSheetPaperMarginsUniform(preset)}
                >
                  {preset === 0 ? "0" : preset}
                </ChipButton>
              ))}
              <ChipButton onClick={resetSheetPaperMargins}>Default</ChipButton>
            </div>

            <button
              type="button"
              onClick={() => setMarginAdvanced((v) => !v)}
              className="text-left text-[11px] text-violet-300/90 hover:text-violet-200"
            >
              {marginAdvanced ? "▾ Sembunyikan lanjutan" : "▸ Margin per sisi"}
            </button>

            {marginAdvanced ? (
              <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-white/75">
                  <Checkbox
                    checked={sheetMarginUniform}
                    onCheckedChange={(v) => setSheetMarginUniform(v === true)}
                  />
                  Margin seragam
                </label>
                {sheetMarginUniform ? (
                  <label className="flex items-center gap-2 text-xs text-white/80">
                    Semua sisi
                    <input
                      type="number"
                      min={MARGIN_MIN_MM}
                      max={MARGIN_MAX_MM}
                      value={sheetPaperMargins.top}
                      onChange={(e) =>
                        setSheetPaperMarginsUniform(Number(e.target.value))
                      }
                      className="w-14 rounded border border-white/15 bg-white/5 px-1 py-1 text-center text-white"
                    />
                    mm
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {marginSides.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center justify-between gap-1 text-[11px] text-white/75"
                      >
                        {label}
                        <input
                          type="number"
                          min={MARGIN_MIN_MM}
                          max={MARGIN_MAX_MM}
                          value={sheetPaperMargins[key]}
                          onChange={(e) =>
                            setSheetPaperMarginSide(key, Number(e.target.value))
                          }
                          className="w-12 rounded border border-white/15 bg-white/5 px-1 py-0.5 text-center text-white"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </PanelSection>

          <PanelSection
            title="Baris & ukuran"
            description="Atur jumlah dan ukuran foto per baris"
          >
            <div className="flex flex-col gap-2">
              {sheetRecipe.rows.map((row, rowIndex) => {
                const rowValidation = validation.rows[rowIndex];
                const rowFits = rowValidation?.fits ?? true;

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-lg border p-2.5",
                      rowFits
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-red-500/50 bg-red-500/10"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white/85">
                        Baris {rowIndex + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        {rowValidation ? (
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              rowFits ? "text-white/45" : "text-red-300"
                            )}
                          >
                            {mmFromPaper(
                              sheetRecipe.paperId,
                              rowValidation.widthPx
                            )}{" "}
                            /{" "}
                            {mmFromPaper(
                              sheetRecipe.paperId,
                              rowValidation.maxWidthPx
                            )}{" "}
                            mm
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {row.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <select
                            value={item.photoSizeId}
                            onChange={(e) =>
                              updateItem(row.id, item.id, {
                                photoSizeId: e.target.value,
                                customMm: undefined,
                              })
                            }
                            className="min-h-[36px] flex-1 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white"
                          >
                            {PHOTO_SIZE_PRESETS.map((photo) => (
                              <option key={photo.id} value={photo.id}>
                                {photo.label}
                              </option>
                            ))}
                          </select>
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
                            className="w-11 rounded-md border border-white/15 bg-white/5 px-1 py-1.5 text-center text-xs text-white"
                            title="Jumlah"
                          />
                          <button
                            type="button"
                            onClick={() => maxFillItem(row, item)}
                            className="rounded-md bg-white/10 px-2 py-1.5 text-[10px] text-white hover:bg-white/20"
                          >
                            Max
                          </button>
                          {row.items.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeItem(row.id, item.id)}
                              className="rounded p-1 text-white/40 hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addItemToRow(row.id)}
                        className="flex items-center gap-1 self-start text-[11px] text-white/55 hover:text-white"
                      >
                        <Plus className="h-3 w-3" />
                        Ukuran lain
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 text-xs text-white/55 hover:border-white/35 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah baris
              </button>
            </div>
          </PanelSection>

          <PanelSection title="Foto ke slot">
            <SegmentedControl
              value={sheetBindingMode}
              onChange={setSheetBindingMode}
              options={BINDING_MODES}
            />

            {sheetBindingMode === "by-size" && images.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                {uniqueSizes.map((size) => (
                  <label
                    key={size.key}
                    className="flex flex-col gap-1 text-xs text-white/80"
                  >
                    <span className="text-white/55">{size.label}</span>
                    <select
                      value={sheetSizeAssignments[size.key] ?? ""}
                      onChange={(e) =>
                        setSheetSizeAssignment(size.key, e.target.value)
                      }
                      className="min-h-[36px] rounded-md border border-white/15 bg-white/5 px-2 text-white"
                    >
                      <option value="">Bergilir otomatis</option>
                      {images.map((img, index) => (
                        <option key={img.filename} value={img.filename}>
                          Foto {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}

            {sheetBindingMode === "manual" && images.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-white/50">
                  Pilih foto lalu klik slot di preview
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {images.map((img, index) => (
                    <ChipButton
                      key={img.filename}
                      active={sheetAssignImageFilename === img.filename}
                      onClick={() => setSheetAssignImageFilename(img.filename)}
                    >
                      Foto {index + 1}
                    </ChipButton>
                  ))}
                </div>
              </div>
            ) : null}

            {sheetBindingMode === "cycle" && images.length === 1 ? (
              <p className="text-[11px] text-white/45">
                Foto akan diulang ke semua {slotCount} slot.
              </p>
            ) : null}
          </PanelSection>

          <PanelSection title="Output">
            <div className="flex flex-col gap-2">
              <SegmentedControl
                value={sheetAlign}
                onChange={setSheetAlign}
                options={[
                  { id: "top-left", label: "Atas" },
                  { id: "center", label: "Tengah" },
                ]}
              />
              <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-xs text-white/80">
                <Checkbox
                  checked={showCutLines}
                  onCheckedChange={(v) => setShowCutLines(v === true)}
                />
                Tampilkan garis potong
              </label>
              <label className="flex items-center gap-2 text-xs text-white/80">
                Salinan lembar
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={sheetCopies}
                  onChange={(e) => setSheetCopies(Number(e.target.value))}
                  className="w-14 rounded-md border border-white/15 bg-white/5 px-1 py-1 text-center text-white"
                />
              </label>
            </div>
          </PanelSection>

          {!canPrint ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              {!validation.fitsVertically ? (
                <p>
                  Tinggi layout (
                  {mmFromPaper(
                    sheetRecipe.paperId,
                    validation.totalHeightPx
                  )}{" "}
                  mm) melebihi area cetak (
                  {mmFromPaper(
                    sheetRecipe.paperId,
                    validation.maxHeightPx
                  )}{" "}
                  mm).
                </p>
              ) : (
                <p>Beberapa baris melebihi lebar kertas. Kurangi qty atau margin.</p>
              )}
            </div>
          ) : null}
      </div>
    </div>
  );

  return (
    <>
      {embedded ? (
        body
      ) : (
        <aside
          className={cn(
            panelShellClass,
            "w-full shrink-0 border-r md:w-[240px] lg:w-[280px] xl:w-[300px]"
          )}
        >
          <div className="border-b border-white/10 px-3 py-2.5">
            <p className="text-sm font-medium text-white">Layout</p>
            <p className="text-[11px] text-white/45">
              {slotCount} slot · {sheetRecipe.paperId} · margin{" "}
              {sheetPaperMargins.top}mm
            </p>
          </div>
          {body}
        </aside>
      )}

      <SavedTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        recipe={sheetRecipe}
        onApply={setSheetRecipe}
      />
    </>
  );
}
