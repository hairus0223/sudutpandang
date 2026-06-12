"use client";

import { CheckSquare, Square } from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { getProcessingStatusLabel } from "@/lib/processingLabels";
import type { PackageType, ProcessingPhase, ProcessingStatus } from "@/lib/imageTypes";

type PhotoCardProps = {
  src: string;
  filename: string;
  onClick: () => void;
  processingStatus?: ProcessingStatus;
  processingPhase?: ProcessingPhase | null;
  packageType?: PackageType;
  processingError?: string | null;
  onRemoveBackground?: () => void;
  removeBackgroundLoading?: boolean;
  onApplyTheme?: () => void;
  applyThemeLoading?: boolean;
  showApplyTheme?: boolean;
  hideFilename?: boolean;
  hidePrintToggle?: boolean;
  style?: React.CSSProperties;
};

function canRemoveBackground(status?: ProcessingStatus) {
  return status === "none" || status === "failed" || status === undefined;
}

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
  processingPhase,
  packageType = "self-photo",
  processingError,
  onRemoveBackground,
  removeBackgroundLoading = false,
  onApplyTheme,
  applyThemeLoading = false,
  showApplyTheme = false,
  hideFilename = false,
  hidePrintToggle = false,
  style,
}: PhotoCardProps) {
  const { selectedForPrint, togglePrint } = useGalleryStore();
  const isSelected = selectedForPrint.includes(filename);
  const statusLabel = getProcessingStatusLabel(processingStatus, {
    packageType,
    processingPhase,
    short: true,
  });
  const isActionLoading = removeBackgroundLoading || applyThemeLoading;
  const showRetry =
    processingStatus === "failed" &&
    Boolean(onRemoveBackground) &&
    !isActionLoading;
  const showRemoveBg =
    Boolean(onRemoveBackground) &&
    canRemoveBackground(processingStatus) &&
    processingStatus !== "failed" &&
    !isActionLoading;
  const showThemeButton =
    showApplyTheme &&
    Boolean(onApplyTheme) &&
    processingStatus !== "pending" &&
    processingStatus !== "processing" &&
    !isActionLoading;

  return (
    <div
      className="relative mb-5 break-inside-avoid cursor-pointer group"
      style={{ transform: "translateZ(0)", ...style }}
    >
      {/* PRINT TOGGLE */}
      {!hidePrintToggle && (
        <div
          onClick={() => togglePrint(filename)}
          className="absolute top-3 left-3 z-20 rounded bg-black/60 p-0.5 backdrop-blur
                     hover:bg-black/80 transition"
        >
          {isSelected ? (
            <CheckSquare className="w-6 h-6 text-green-400" />
          ) : (
            <Square className="w-6 h-6 text-white" />
          )}
        </div>
      )}

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

      {(showThemeButton || showRemoveBg || showRetry || isActionLoading) && (
        <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-1">
          {showThemeButton && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onApplyTheme?.();
              }}
              className="rounded-full bg-emerald-600/90 px-3 py-1 text-xs text-white backdrop-blur hover:bg-emerald-500 transition"
            >
              Terapkan Tema
            </button>
          )}

          {showRemoveBg && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveBackground?.();
              }}
              className="rounded-full bg-violet-600/90 px-3 py-1 text-xs text-white backdrop-blur hover:bg-violet-500 transition"
            >
              Hapus BG
            </button>
          )}

          {showRetry && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveBackground?.();
              }}
              className="rounded-full bg-amber-600/90 px-3 py-1 text-xs text-white backdrop-blur hover:bg-amber-500 transition"
            >
              Coba lagi
            </button>
          )}

          {isActionLoading && (
            <div className="rounded-full bg-amber-500/80 px-3 py-1 text-xs text-white backdrop-blur">
              {applyThemeLoading
                ? "Menerapkan tema…"
                : removeBackgroundLoading
                  ? "Memproses…"
                  : "Memproses…"}
            </div>
          )}
        </div>
      )}

      {/* FILENAME */}
      {!hideFilename && (
        <div
          className="absolute bottom-3 right-3 z-20 rounded-full bg-black/60
                     px-3 py-1 text-xs text-white backdrop-blur"
        >
          {filename}
        </div>
      )}

      {/* IMAGE */}
      <img
        src={src}
        onClick={onClick}
        alt={filename}
        draggable={false}
        className="w-full rounded-lg object-cover shadow-md
                   transition-transform duration-300
                   group-hover:scale-[1.02]"
      />
    </div>
  );
}
