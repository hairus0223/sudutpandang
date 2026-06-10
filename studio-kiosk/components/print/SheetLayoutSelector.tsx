"use client";

import { useState } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import {
  CUSTOM_PHOTO_SIZE_ID,
  createPhotoSizeFromMm,
  PHOTO_SIZE_PRESETS,
} from "@/lib/photoSizes";
import { getPaperPreset, PAPER_PRESETS } from "@/lib/paperSizes";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";
import {
  createSheetLayout,
  getDefaultLayoutForPaperAndPhoto,
  getLayoutsForPaperAndPhoto,
  resolvePhotoForLayout,
  resolveSheetLayoutContext,
  type SheetLayoutPreset,
} from "@/lib/sheetLayouts";
import { suggestMaxSheetLayout } from "@/utils/sheetLayoutEngine";
import { cn } from "@/lib/utils";

export function SheetLayoutSelector() {
  const {
    printMode,
    setPrintMode,
    sheetLayout,
    setSheetLayout,
    customPhotoSize,
    setCustomPhotoSize,
    sheetCopies,
    setSheetCopies,
    showCutLines,
    setShowCutLines,
    printTemplate,
    setPrintTemplate,
  } = useGalleryStore();

  const effectivePhoto = resolvePhotoForLayout(sheetLayout, customPhotoSize);
  const { slotCount } = resolveSheetLayoutContext(sheetLayout, customPhotoSize);
  const layoutsForPaper = getLayoutsForPaperAndPhoto(
    sheetLayout.paperId,
    sheetLayout.photoSizeId === CUSTOM_PHOTO_SIZE_ID
      ? CUSTOM_PHOTO_SIZE_ID
      : sheetLayout.photoSizeId
  ).filter((l) => l.photoSizeId !== CUSTOM_PHOTO_SIZE_ID);

  const isCustomPhoto = sheetLayout.photoSizeId === CUSTOM_PHOTO_SIZE_ID;
  const [customWidthMm, setCustomWidthMm] = useState(
    () => Math.round((customPhotoSize?.widthInch ?? 50 / 25.4) * 25.4)
  );
  const [customHeightMm, setCustomHeightMm] = useState(
    () => Math.round((customPhotoSize?.heightInch ?? 70 / 25.4) * 25.4)
  );

  const handlePaperChange = (paperId: string) => {
    const photoSizeId = sheetLayout.photoSizeId;
    const preset = getDefaultLayoutForPaperAndPhoto(paperId, photoSizeId);
    if (preset) {
      setSheetLayout(preset);
      return;
    }

    if (photoSizeId === CUSTOM_PHOTO_SIZE_ID && customPhotoSize) {
      const paper = getPaperPreset(paperId);
      const { cols, rows } = suggestMaxSheetLayout(paper, customPhotoSize);
      setSheetLayout(
        createSheetLayout({
          paperId,
          photoSizeId: CUSTOM_PHOTO_SIZE_ID,
          cols,
          rows,
          photo: customPhotoSize,
        })
      );
    }
  };

  const handlePhotoSizeChange = (photoSizeId: string) => {
    if (photoSizeId === CUSTOM_PHOTO_SIZE_ID) {
      const photo = customPhotoSize ?? createPhotoSizeFromMm(customWidthMm, customHeightMm);
      setCustomPhotoSize(photo);
      const paper = getPaperPreset(sheetLayout.paperId);
      const { cols, rows } = suggestMaxSheetLayout(paper, photo);
      setSheetLayout(
        createSheetLayout({
          paperId: sheetLayout.paperId,
          photoSizeId: CUSTOM_PHOTO_SIZE_ID,
          cols,
          rows,
          photo,
        })
      );
      return;
    }

    setCustomPhotoSize(null);
    const nextLayouts = getLayoutsForPaperAndPhoto(sheetLayout.paperId, photoSizeId);
    if (nextLayouts.length > 0) setSheetLayout(nextLayouts[0]);
  };

  const handleCustomMmApply = () => {
    const photo = createPhotoSizeFromMm(customWidthMm, customHeightMm);
    setCustomPhotoSize(photo);
    setSheetLayout(
      createSheetLayout({
        paperId: sheetLayout.paperId,
        photoSizeId: CUSTOM_PHOTO_SIZE_ID,
        cols: sheetLayout.cols,
        rows: sheetLayout.rows,
        cutGapMm: sheetLayout.cutGapMm,
        photo,
      })
    );
  };

  const handleMaxLayout = () => {
    const paper = getPaperPreset(sheetLayout.paperId);
    const { cols, rows } = suggestMaxSheetLayout(
      paper,
      effectivePhoto,
      sheetLayout.cutGapMm
    );
    setSheetLayout(
      createSheetLayout({
        paperId: sheetLayout.paperId,
        photoSizeId: effectivePhoto.id,
        cols,
        rows,
        cutGapMm: sheetLayout.cutGapMm,
        photo: effectivePhoto,
      })
    );
  };

  const pickLayout = (layout: SheetLayoutPreset) => {
    setSheetLayout(layout);
    if (layout.photoSizeId !== CUSTOM_PHOTO_SIZE_ID) {
      setCustomPhotoSize(null);
    }
  };

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setPrintMode("classic")}
          className={cn(
            "rounded px-3 py-1.5 text-xs sm:text-sm transition",
            printMode === "classic"
              ? "bg-green-600 text-white"
              : "bg-white/10 hover:bg-white/20"
          )}
        >
          Klasik 4R
        </button>
        <button
          type="button"
          onClick={() => setPrintMode("sheet")}
          className={cn(
            "rounded px-3 py-1.5 text-xs sm:text-sm transition",
            printMode === "sheet"
              ? "bg-green-600 text-white"
              : "bg-white/10 hover:bg-white/20"
          )}
        >
          Cetak Lembar
        </button>
      </div>

      {printMode === "classic" ? (
        <div className="flex flex-wrap justify-center gap-2">
          {PRINT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setPrintTemplate(tpl)}
              className={cn(
                "rounded px-3 py-1.5 text-xs sm:text-sm transition",
                printTemplate.id === tpl.id
                  ? "bg-white/20 text-white"
                  : "bg-white/10 hover:bg-white/20"
              )}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-white/70">Kertas:</span>
            {PAPER_PRESETS.map((paper) => (
              <button
                key={paper.id}
                type="button"
                onClick={() => handlePaperChange(paper.id)}
                className={cn(
                  "rounded px-2 py-1 text-xs transition",
                  sheetLayout.paperId === paper.id
                    ? "bg-violet-600 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {paper.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {PHOTO_SIZE_PRESETS.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => handlePhotoSizeChange(photo.id)}
                className={cn(
                  "rounded px-3 py-1.5 text-xs sm:text-sm transition",
                  sheetLayout.photoSizeId === photo.id
                    ? "bg-violet-600 text-white"
                    : "bg-white/10 hover:bg-white/20"
                )}
              >
                {photo.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePhotoSizeChange(CUSTOM_PHOTO_SIZE_ID)}
              className={cn(
                "rounded px-3 py-1.5 text-xs sm:text-sm transition",
                isCustomPhoto
                  ? "bg-violet-600 text-white"
                  : "bg-white/10 hover:bg-white/20"
              )}
            >
              Ukuran kustom
            </button>
          </div>

          {isCustomPhoto && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/80">
              <label className="flex items-center gap-1">
                Lebar (mm)
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={customWidthMm}
                  onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                  className="w-16 rounded bg-white/10 px-2 py-1 text-white"
                />
              </label>
              <label className="flex items-center gap-1">
                Tinggi (mm)
                <input
                  type="number"
                  min={10}
                  max={400}
                  value={customHeightMm}
                  onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                  className="w-16 rounded bg-white/10 px-2 py-1 text-white"
                />
              </label>
              <button
                type="button"
                onClick={handleCustomMmApply}
                className="rounded bg-white/15 px-2 py-1 hover:bg-white/25"
              >
                Terapkan
              </button>
            </div>
          )}

          {layoutsForPaper.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {layoutsForPaper.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => pickLayout(layout)}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs sm:text-sm transition",
                    sheetLayout.id === layout.id
                      ? "bg-green-600 text-white"
                      : "bg-white/10 hover:bg-white/20"
                  )}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/70">
            <span>
              {slotCount} slot · {effectivePhoto.label} · jarak potong{" "}
              {sheetLayout.cutGapMm} mm
            </span>
            <button
              type="button"
              onClick={handleMaxLayout}
              className="rounded bg-white/15 px-2 py-1 text-white hover:bg-white/25"
            >
              Muat maksimal
            </button>
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
              Salinan lembar
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
      )}
    </div>
  );
}
