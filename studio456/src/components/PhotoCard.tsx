import { CheckSquare, Square } from "lucide-react";
import React from "react";

type PhotoCardProps = {
  id: number;
  src: string;
  filename: string;
  refProp?: React.RefObject<HTMLDivElement> | null;
  onClick: (id: number) => void;
  onTogglePrint: (filename: string) => void;
  isSelected?: boolean;
};

export function PhotoCard({
  id,
  src,
  filename,
  onClick,
  refProp,
  isSelected,
  onTogglePrint,
}: PhotoCardProps) {
  return (
    <div
      ref={refProp || undefined}
      className="group relative mb-5 block w-full cursor-pointer"
      style={{
        transform: "translateZ(0)",
        willChange: "transform, filter",
      }}
    >
      {/* === PRINT SELECT BUTTON === */}
      <div
        onClick={(e) => {
          e.stopPropagation(); // prevent opening modal
          onTogglePrint(filename);
        }}
        className="absolute top-2 left-2 z-50 bg-black/60 p-0.5 rounded-sm hover:bg-black/80 transition"
      >
        {isSelected ? (
          <CheckSquare className="w-6 h-6 text-green-400" />
        ) : (
          <Square className="w-6 h-6 text-white" />
        )}
      </div>

      {/* === LABEL FILENAME === */}
      <div className="absolute bottom-2 right-2 z-40 bg-gray-700 text-white text-xs px-2 py-1 rounded-full shadow-lg">
        {filename}
      </div>

      {/* === IMAGE === */}
      <img
        src={src}
        alt={`Photo ${id}`}
        onClick={() => onClick(id)}
        className="w-full rounded-lg object-cover transition duration-300 ease-out group-hover:brightness-110 group-hover:scale-[1.02] shadow-md"
        style={{ transform: "translateZ(0)" }}
      />
    </div>
  );
}
