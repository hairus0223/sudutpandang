"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";

export function SheetAdjustToolbar() {
  const {
    printMode,
    activeAdjustMeta,
    getSheetSlotTransform,
    setSheetSlotTransform,
    resetSheetSlotTransform,
    showCutLines,
    setShowCutLines,
  } = useGalleryStore();

  if (printMode !== "sheet") return null;

  const meta = activeAdjustMeta;

  const adjustZoom = (delta: number) => {
    if (!meta) return;

    const current = getSheetSlotTransform(
      meta.filename,
      meta.sizeKey,
      meta.slotIndex
    );
    const nextScale = Math.min(3, Math.max(1, current.scale + delta));

    setSheetSlotTransform(meta.filename, meta.sizeKey, meta.slotIndex, {
      scale: nextScale,
    });
  };

  const resetActive = () => {
    if (!meta) return;
    resetSheetSlotTransform(meta.filename, meta.sizeKey, meta.slotIndex);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/80">
      <span className="rounded bg-white/10 px-2 py-1">
        {meta
          ? `Slot ${meta.slotIndex + 1} · ${meta.label}`
          : "Klik slot pada lembar untuk menyesuaikan"}
      </span>

      <button
        type="button"
        disabled={!meta}
        onClick={() => adjustZoom(-0.1)}
        className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
        Zoom
      </button>

      <button
        type="button"
        disabled={!meta}
        onClick={() => adjustZoom(0.1)}
        className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Zoom
      </button>

      <button
        type="button"
        disabled={!meta}
        onClick={resetActive}
        className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-40"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>

      <label className="flex cursor-pointer items-center gap-2 rounded bg-white/10 px-2 py-1">
        <input
          type="checkbox"
          checked={showCutLines}
          onChange={(e) => setShowCutLines(e.target.checked)}
          className="accent-green-500"
        />
        Garis potong
      </label>
    </div>
  );
}
