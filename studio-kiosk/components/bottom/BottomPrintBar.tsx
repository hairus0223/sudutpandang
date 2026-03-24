"use client";

import { Printer, Trash2 } from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";

type BottomPrintBarProps = {
  onContinue: () => void;
};

export function BottomPrintBar({ onContinue }: BottomPrintBarProps) {
  const {
    selectedForPrint,
    allowedPrint,
    resetSelection,
  } = useGalleryStore();

  if (selectedForPrint.length === 0) return null;

  return (
    <div
      data-bottom-bar
      className="fixed bottom-0 left-0 right-0 z-50
                 bg-black/90 backdrop-blur
                 border-t border-white/10"
    >
      <div
        className="mx-auto max-w-[1960px]
                   px-4 sm:px-6 py-3 sm:py-4
                   flex flex-wrap items-center justify-between gap-3"
      >
        {/* INFO */}
        <div className="text-white text-base sm:text-lg">
          <span className="font-semibold">{selectedForPrint.length}</span> / {allowedPrint} foto dipilih
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={resetSelection}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded text-sm sm:text-base bg-white/10 text-white hover:bg-white/20 transition"
          >
            <Trash2 size={18} />
            Reset
          </button>

          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg bg-green-600 text-white text-base sm:text-lg hover:bg-green-500 transition"
          >
            <Printer size={20} />
            Lanjut Cetak
          </button>
        </div>
      </div>
    </div>
  );
}
