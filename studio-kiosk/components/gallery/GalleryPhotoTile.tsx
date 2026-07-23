"use client";

import { Maximize2, Square, X } from "lucide-react";
import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";
import { PhotoCard } from "@/components/cards/PhotoCard";
import { getOriginalPreviewUrl } from "@/lib/aiGalleryUtils";
import {
  badgePrintOutline,
  btnIconSm,
  btnSelect,
} from "@/lib/galleryUiStyles";
import { cn } from "@/lib/utils";

type GalleryPhotoTileProps = {
  image: GalleryImageData;
  index: number;
  isSelected: boolean;
  selectionIndex?: number | null;
  isPrintSelected: boolean;
  printVariant: PrintVariant;
  onToggleSelect: () => void;
  onTogglePrint: () => void;
  onOpenPhoto: () => void;
  aiStatus?: string | null;
  aiStatusBadge?: React.ReactNode;
  accent?: "violet" | "gold";
  isBusy?: boolean;
};

export function GalleryPhotoTile({
  image,
  isSelected,
  selectionIndex,
  isPrintSelected,
  printVariant,
  onToggleSelect,
  onTogglePrint,
  onOpenPhoto,
  aiStatusBadge,
  accent = "violet",
  isBusy = false,
}: GalleryPhotoTileProps) {
  const ringClass =
    accent === "violet"
      ? "ring-violet-400/80 ring-offset-[#0a0a0a]"
      : "ring-[#E8C872]/80 ring-offset-[#0a0a0a]";

  return (
    <div
      className={cn(
        "relative mb-5 break-inside-avoid rounded-xl transition",
        isSelected && cn("ring-2 ring-offset-2", ringClass)
      )}
    >
      <button
        type="button"
        onClick={onToggleSelect}
        className={btnSelect(isSelected, accent)}
        aria-label={isSelected ? "Batalkan pilihan" : "Pilih foto"}
      >
        {isSelected ? (
          <span className="text-xs font-bold">{selectionIndex}</span>
        ) : (
          <Square className="size-4" />
        )}
      </button>

      <PhotoCard
        src={getOriginalPreviewUrl(image)}
        filename={image.filename}
        processingStatus={image.processingStatus}
        processingError={image.processingError}
        hidePrintToggle
        hideFilename
        onClick={onToggleSelect}
      />

      {aiStatusBadge}

      {isPrintSelected ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePrint();
          }}
          className={`${badgePrintOutline(printVariant === "ai" ? "ai" : "original")}`}
          title="Tap untuk batalkan cetak"
        >
          Cetak {printVariant === "ai" ? "AI" : "Asli"}
          <X className="size-3" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPhoto();
        }}
        className={cn(btnIconSm(), "absolute bottom-3 right-3 z-20")}
        aria-label="Perbesar foto"
      >
        <Maximize2 className="size-4" />
      </button>

      {isBusy ? (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-black/20" />
      ) : null}
    </div>
  );
}
