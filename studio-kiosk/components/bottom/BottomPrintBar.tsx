"use client";

import { Printer, Trash2 } from "lucide-react";
import { btnNeutral, btnPrimary, btnSuccess, galleryBtnRowClass } from "@/lib/galleryUiStyles";
import { cn } from "@/lib/utils";
import { useGalleryStore } from "@/stores/useGalleryStore";

type BottomPrintBarProps = {
  onContinue: () => void;
};

export function BottomPrintBar({ onContinue }: BottomPrintBarProps) {
  const {
    selectedForPrint,
    allowedPrint,
    printVariantByFilename,
    resetSelection,
    packageType,
  } = useGalleryStore();

  if (selectedForPrint.length === 0) return null;

  const isAi = packageType === "ai-self-photo";
  const aiCount = selectedForPrint.filter(
    (filename) => printVariantByFilename[filename] === "ai"
  ).length;

  return (
    <div
      data-bottom-bar
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-white/10 bg-black/92 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1960px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 text-base text-white sm:text-lg">
          <span className="font-semibold text-[#E8C872]">{selectedForPrint.length}</span>
          <span className="text-white/70"> / {allowedPrint} foto dipilih</span>
          {isAi && aiCount > 0 ? (
            <span className="ml-2 text-sm font-medium text-violet-300">
              ({aiCount} AI)
            </span>
          ) : null}
        </div>

        <div className={galleryBtnRowClass}>
          <button type="button" onClick={resetSelection} className={btnNeutral()}>
            <Trash2 className="size-4" />
            Reset
          </button>

          <button
            type="button"
            onClick={onContinue}
            className={cn(
              isAi ? btnPrimary() : btnSuccess(),
              "px-6 py-3 text-base sm:text-lg"
            )}
          >
            <Printer className="size-5" />
            Lanjut Cetak
          </button>
        </div>
      </div>
    </div>
  );
}
