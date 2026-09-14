"use client";

import type { ReactNode } from "react";
import { Check, ImageIcon, Printer, Sparkles, X } from "lucide-react";
import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";
import { getOriginalPreviewUrl } from "@/lib/aiGalleryUtils";
import {
  btnAi,
  btnGhost,
  btnNeutral,
  btnPrint,
  galleryBtnRowClass,
  galleryPanelClass,
} from "@/lib/galleryUiStyles";
import { cn } from "@/lib/utils";

type GalleryPrintSelectionBarProps = {
  selectedImages: GalleryImageData[];
  printSelectedCount: number;
  allowedPrint: number;
  totalPrintSelected: number;
  onClearSelection: () => void;
  onEnqueuePrint: (variant: PrintVariant) => void;
  onRemovePrintFromSelection: () => void;
  originalQueuedCount?: number;
  aiQueuedCount?: number;
  aiPrintReadyCount?: number;
  accent?: "violet" | "gold";
  extraActions?: ReactNode;
  hint?: string;
  showAiPrint?: boolean;
  showThemePrint?: boolean;
  themeQueuedCount?: number;
  themePrintReadyCount?: number;
};

export function GalleryPrintSelectionBar({
  selectedImages,
  printSelectedCount,
  allowedPrint,
  totalPrintSelected,
  onClearSelection,
  onEnqueuePrint,
  onRemovePrintFromSelection,
  originalQueuedCount = 0,
  aiQueuedCount = 0,
  aiPrintReadyCount = 0,
  accent = "violet",
  extraActions,
  hint,
  showAiPrint = false,
  showThemePrint = false,
  themeQueuedCount = 0,
  themePrintReadyCount = 0,
}: GalleryPrintSelectionBarProps) {
  const borderClass =
    accent === "violet" ? "border-violet-400/30" : "border-[#E8C872]/30";
  const allOriginalQueued =
    selectedImages.length > 0 && originalQueuedCount === selectedImages.length;
  const allAiQueued =
    showAiPrint && aiPrintReadyCount > 0 && aiQueuedCount === aiPrintReadyCount;

  const originalSuffix = showAiPrint || showThemePrint ? " · asli" : "";
  const allThemeQueued =
    showThemePrint &&
    themePrintReadyCount > 0 &&
    themeQueuedCount === themePrintReadyCount;
  const originalLabel = allOriginalQueued
    ? `Sudah di antrian${originalSuffix}`
    : originalQueuedCount > 0 || aiQueuedCount > 0 || themeQueuedCount > 0
      ? "Ganti ke versi asli"
      : `Masukkan antrian cetak${originalSuffix}`;

  if (selectedImages.length === 0) {
    return (
      <div className={cn(galleryPanelClass, borderClass)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-white/50">
            {hint ??
              "Pilih foto dulu, lalu masukkan ke antrian cetak. Lanjut Cetak ada di bawah layar."}
          </p>
          {totalPrintSelected > 0 ? (
            <p className="text-xs font-medium text-[#E8C872]">
              Antrian cetak {totalPrintSelected}/{allowedPrint}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(galleryPanelClass, borderClass)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              accent === "violet" ? "text-violet-50" : "text-[#E8C872]"
            )}
          >
            {selectedImages.length} foto dipilih
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            {printSelectedCount > 0
              ? `${printSelectedCount} sudah di antrian cetak`
              : "Belum masuk antrian cetak — ketuk tombol di bawah"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          className={btnGhost()}
          aria-label="Hapus pilihan foto"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mb-4 flex gap-2.5 overflow-x-auto pb-1">
        {selectedImages.slice(0, 8).map((img) => (
          <img
            key={img.filename}
            src={getOriginalPreviewUrl(img)}
            alt=""
            className="h-16 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/20"
          />
        ))}
        {selectedImages.length > 8 ? (
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-white/50">
            +{selectedImages.length - 8}
          </div>
        ) : null}
      </div>

      <div className={galleryBtnRowClass}>
        {extraActions}

        <button
          type="button"
          onClick={() => onEnqueuePrint("original")}
          disabled={allOriginalQueued}
          className={cn(
            allOriginalQueued ? btnPrint(true) : btnPrint(false),
            "flex-1 sm:flex-none"
          )}
        >
          {allOriginalQueued ? (
            <Check className="size-4" />
          ) : (
            <ImageIcon className="size-4" />
          )}
          {originalLabel}
        </button>

        {showThemePrint && themePrintReadyCount > 0 ? (
          <button
            type="button"
            onClick={() => onEnqueuePrint("theme")}
            disabled={allThemeQueued}
            className={cn(
              allThemeQueued ? btnPrint(true) : btnPrint(false),
              "flex-1 sm:flex-none"
            )}
          >
            {allThemeQueued ? (
              <Check className="size-4" />
            ) : (
              <Printer className="size-4" />
            )}
            {allThemeQueued
              ? "Sudah di antrian · tema"
              : `Masukkan antrian · tema (${themePrintReadyCount})`}
          </button>
        ) : null}

        {showAiPrint && aiPrintReadyCount > 0 ? (
          <button
            type="button"
            onClick={() => onEnqueuePrint("ai")}
            disabled={allAiQueued}
            className={cn(
              allAiQueued ? btnAi(true) : btnAi(false),
              "flex-1 sm:flex-none"
            )}
          >
            {allAiQueued ? <Check className="size-4" /> : <Sparkles className="size-4" />}
            {allAiQueued
              ? "Sudah di antrian · AI"
              : `Masukkan antrian · AI (${aiPrintReadyCount})`}
          </button>
        ) : null}

        {printSelectedCount > 0 ? (
          <button
            type="button"
            onClick={onRemovePrintFromSelection}
            className={cn(btnNeutral(), "flex-1 sm:flex-none")}
          >
            <X className="size-4" />
            Hapus dari antrian
          </button>
        ) : null}

        {totalPrintSelected > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#E8C872]/50 bg-[#E8C872]/8 px-3 py-2 text-xs font-semibold text-[#E8C872]">
            <Printer className="size-3.5" />
            Antrian {totalPrintSelected}/{allowedPrint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
