"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { X, ArrowLeft, ArrowRight, Square, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ImageData = { filename: string; url: string };

interface PhotoModalProps {
  open: boolean;
  images: ImageData[];
  photoIndex: number | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetPhoto: (index: number) => void;
  selectedForPrint: string[];
  togglePrintSelection: (filename: string) => void;
}

export function PhotoModal({
  open,
  images,
  photoIndex,
  onClose,
  onNext,
  onPrev,
  onSetPhoto,
  selectedForPrint,
  togglePrintSelection,
}: PhotoModalProps) {
  const currentImage = photoIndex !== null ? images[photoIndex] : null;

  // ============================
  // 🔥 Preload next/prev images
  // ============================
  React.useEffect(() => {
    if (photoIndex === null) return;

    const preloadNext = new Image();
    preloadNext.src = images[photoIndex + 1]?.url ?? "";

    const preloadPrev = new Image();
    preloadPrev.src = images[photoIndex - 1]?.url ?? "";
  }, [photoIndex, images]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onNext, onPrev]);

  if (!currentImage || photoIndex === null) return null;

  const isSelected = selectedForPrint.includes(currentImage.filename);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
        {/* Close button */}
        <div
          className="absolute cursor-pointer top-4 left-4 h-10 w-10 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition"
          onClick={onClose}
        >
          <X className="text-white w-6 h-6" />
        </div>

        {/* Print selection button */}
        <div className="absolute top-4 right-4 flex gap-2">
          <div
            onClick={() => togglePrintSelection(currentImage.filename)}
            className={`cursor-pointer flex gap-3 text-white items-center justify-center rounded-full px-4 py-2 transition
              ${
                isSelected
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-black/60 hover:bg-black/80"
              }`}
          >
            {isSelected ? (
              <CheckSquare className="text-white w-5 h-5" />
            ) : (
              <Square className="text-white w-5 h-5" />
            )}
            Pilih Cetak
          </div>
        </div>

        {isSelected && (
          <div className="absolute top-16 right-4 text-xs bg-green-600 px-3 py-1 rounded-full">
            Foto ini dipilih untuk dicetak
          </div>
        )}

        {/* Main image */}
        <div className="relative flex items-center justify-center w-full h-[calc(100vh-120px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentImage.url}
              className="flex items-center justify-center w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              style={{ willChange: "opacity" }} // GPU acceleration
            >
              <img
                src={currentImage.url}
                alt={currentImage.filename}
                className="max-w-[85vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
                draggable={false}
                style={{ userSelect: "none", WebkitUserSelect: "none" }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Left arrow */}
          {photoIndex > 0 && (
            <div
              onClick={onPrev}
              className="absolute cursor-pointer left-4 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition"
            >
              <ArrowLeft className="text-white w-6 h-6" />
            </div>
          )}

          {/* Right arrow */}
          {photoIndex < images.length - 1 && (
            <div
              onClick={onNext}
              className="absolute cursor-pointer right-4 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition"
            >
              <ArrowRight className="text-white w-6 h-6" />
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        <div className="absolute bottom-4 w-full max-w-[95vw] mx-auto overflow-x-auto scrollbar-none">
          <div className="flex gap-2 py-2 px-4">
            {images.map((img, idx) => (
              <div key={idx} onClick={() => onSetPhoto(idx)}>
                <img
                  src={img.url}
                  alt={img.filename}
                  loading="lazy"
                  className={`
                    h-16 w-24 object-cover rounded-lg cursor-pointer
                    ${
                      photoIndex === idx
                        ? "ring-4 ring-white shadow-xl"
                        : "opacity-70 hover:opacity-100"
                    }
                  `}
                  style={{ userSelect: "none", WebkitUserSelect: "none" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
