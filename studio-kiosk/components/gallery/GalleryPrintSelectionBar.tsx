"use client";

import type { ReactNode } from "react";
import { ImageIcon, Printer, Sparkles, X } from "lucide-react";
import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";
import { getOriginalPreviewUrl } from "@/lib/aiGalleryUtils";
import {
  btnAi,
  btnGhost,
  btnNeutral,
  btnPrint,
  btnPrimary,
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
  onBulkTogglePrint: (variant: PrintVariant) => void;
  onRemovePrintFromSelection: () => void;
  allSelectedPrintOriginal?: boolean;
  allSelectedPrintAi?: boolean;
  aiPrintReadyCount?: number;
  accent?: "violet" | "gold";
  extraActions?: ReactNode;
  hint?: string;
};

export function GalleryPrintSelectionBar({
  selectedImages,
  printSelectedCount,
  allowedPrint,
  totalPrintSelected,
  onClearSelection,
  onBulkTogglePrint,
  onRemovePrintFromSelection,
  allSelectedPrintOriginal = false,
  allSelectedPrintAi = false,
  aiPrintReadyCount = 0,
  accent = "violet",
  extraActions,
  hint,
}: GalleryPrintSelectionBarProps) {
  const borderClass =
    accent === "violet" ? "border-violet-400/30" : "border-[#E8C872]/30";

  if (selectedImages.length === 0) {
    return (
      <div className={cn(galleryPanelClass, borderClass)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-white/50">
            {hint ??
              "Tap checkbox atau foto untuk memilih · tap badge cetak (×) untuk batalkan"}
          </p>
          {totalPrintSelected > 0 ? (
            <p className="text-xs font-medium text-[#E8C872]">
              {totalPrintSelected}/{allowedPrint} di antrian cetak
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
            {selectedImages.length} foto terpilih
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            {printSelectedCount > 0
              ? `${printSelectedCount} antrian cetak · `
              : ""}
            Tap tombol cetak lagi untuk batalkan
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
          onClick={() => onBulkTogglePrint("original")}
          className={cn(
            allSelectedPrintOriginal ? btnPrint(true) : btnPrint(false),
            "flex-1 sm:flex-none"
          )}
        >
          <ImageIcon className="size-4" />
          {allSelectedPrintOriginal ? "Batalkan cetak asli" : "Cetak asli"}
        </button>

        {aiPrintReadyCount > 0 ? (
          <button
            type="button"
            onClick={() => onBulkTogglePrint("ai")}
            className={cn(
              allSelectedPrintAi ? btnAi(true) : btnAi(false),
              "flex-1 sm:flex-none"
            )}
          >
            <Sparkles className="size-4" />
            {allSelectedPrintAi
              ? "Batalkan cetak AI"
              : `Cetak AI (${aiPrintReadyCount})`}
          </button>
        ) : null}

        {printSelectedCount > 0 ? (
          <button
            type="button"
            onClick={onRemovePrintFromSelection}
            className={cn(btnNeutral(), "flex-1 sm:flex-none")}
          >
            <X className="size-4" />
            Hapus dari cetak
          </button>
        ) : null}

        {totalPrintSelected > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#E8C872]/50 bg-[#E8C872]/8 px-3 py-2 text-xs font-semibold text-[#E8C872]">
            <Printer className="size-3.5" />
            {totalPrintSelected}/{allowedPrint} antrian
          </span>
        ) : null}
      </div>
    </div>
  );
}
