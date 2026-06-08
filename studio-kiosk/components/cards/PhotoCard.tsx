"use client";

import { CheckSquare, Square } from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import type { ProcessingStatus } from "@/lib/imageTypes";

type PhotoCardProps = {
  src: string;
  filename: string;
  onClick: () => void;
  processingStatus?: ProcessingStatus;
  hideFilename?: boolean;
  hidePrintToggle?: boolean;
  style?: React.CSSProperties;
};

function getStatusLabel(status?: ProcessingStatus) {
  switch (status) {
    case "pending":
    case "processing":
      return "Memproses…";
    case "ready":
      return "Siap";
    case "failed":
      return "Gagal";
    default:
      return null;
  }
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
  hideFilename = false,
  hidePrintToggle = false,
  style,
}: PhotoCardProps) {
  const { selectedForPrint, togglePrint } = useGalleryStore();
  const isSelected = selectedForPrint.includes(filename);
  const statusLabel = getStatusLabel(processingStatus);

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
