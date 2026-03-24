"use client";

import { CheckSquare, Square } from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";

type PhotoCardProps = {
  src: string;
  filename: string;
  onClick: () => void;
  hideFilename?: boolean;      // NEW: hide filename
  hidePrintToggle?: boolean;   // NEW: hide print toggle
  style?: React.CSSProperties;
};

export function PhotoCard({
  src,
  filename,
  onClick,
  hideFilename = false,
  hidePrintToggle = false,
  style,
}: PhotoCardProps) {
  const { selectedForPrint, togglePrint } = useGalleryStore();
  const isSelected = selectedForPrint.includes(filename);

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
