"use client";

import { CheckSquare, Square } from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { getProcessingStatusLabel } from "@/lib/processingLabels";
import { getPrintVariantLabel } from "@/lib/resolveImageUrl";
import type { PrintVariant, ProcessingStatus } from "@/lib/imageTypes";
import { cn } from "@/lib/utils";

type PhotoCardProps = {
  src: string;
  filename: string;
  onClick: () => void;
  processingStatus?: ProcessingStatus;
  processingError?: string | null;
  hideFilename?: boolean;
  hidePrintToggle?: boolean;
  compact?: boolean;
  printVariant?: PrintVariant;
  style?: React.CSSProperties;
};

function getStatusClass(status?: ProcessingStatus) {
  switch (status) {
    case "ready":
      return "bg-green-600/80";
    case "failed":
      return "bg-red-600/80";
    case "pending":
    case "processing":
      return "bg-amber-500/80";
    default:
      return "bg-black/60";
  }
}

export function PhotoCard({
  src,
  filename,
  onClick,
  processingStatus,
  processingError,
  hideFilename = false,
  hidePrintToggle = false,
  compact = false,
  printVariant = "original",
  style,
}: PhotoCardProps) {
  const { selectedForPrint, togglePrint, printVariantByFilename } =
    useGalleryStore();
  const isSelected = selectedForPrint.includes(filename);
  const activeVariant = printVariantByFilename[filename] ?? printVariant;
  const statusLabel = getProcessingStatusLabel(processingStatus);

  return (
    <div
      className={cn(
        "relative cursor-pointer group",
        compact ? "h-full w-full" : "mb-5 break-inside-avoid"
      )}
      style={{ transform: "translateZ(0)", ...style }}
    >
      {!hidePrintToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePrint(filename, printVariant);
          }}
          className={cn(
            "absolute top-3 left-3 z-20 flex size-9 items-center justify-center rounded-xl border-2 backdrop-blur-sm transition active:scale-95",
            isSelected
              ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
              : "border-white/35 bg-black/55 text-white hover:border-white/55 hover:bg-black/70"
          )}
          aria-label={isSelected ? "Batalkan cetak" : "Pilih cetak"}
        >
          {isSelected ? (
            <CheckSquare className="size-5 text-emerald-300" />
          ) : (
            <Square className="size-5" />
          )}
        </button>
      )}

      {isSelected && !hidePrintToggle ? (
        <div
          className={cn(
            "absolute bottom-3 left-3 z-20 rounded-xl border-2 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm",
            activeVariant === "ai"
              ? "border-violet-400/70 text-violet-100"
              : "border-[#E8C872]/70 text-[#E8C872]"
          )}
        >
          {getPrintVariantLabel(activeVariant)}
        </div>
      ) : null}

      {statusLabel && (
        <div
          className={`absolute top-3 right-3 z-20 rounded-full px-3 py-1 text-xs text-white backdrop-blur ${getStatusClass(processingStatus)}`}
        >
          {statusLabel}
        </div>
      )}

      {processingStatus === "failed" && processingError && (
        <div className="absolute left-3 right-3 top-12 z-20 rounded-lg bg-red-950/85 px-3 py-2 text-[11px] leading-snug text-red-100 backdrop-blur">
          {processingError}
        </div>
      )}

      {!hideFilename && (
        <div
          className="absolute bottom-3 right-3 z-20 rounded-full bg-black/60
                     px-3 py-1 text-xs text-white backdrop-blur"
        >
          {filename}
        </div>
      )}

      <img
        src={src}
        onClick={onClick}
        alt={filename}
        draggable={false}
        className={cn(
          "w-full object-cover shadow-md transition-transform duration-300 group-hover:scale-[1.02]",
          compact ? "h-full rounded-none" : "rounded-lg"
        )}
      />
    </div>
  );
}
