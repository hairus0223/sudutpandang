"use client";

import { useEffect, useMemo } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useResolvedSheetPaper } from "@/hooks/useResolvedSheetPaper";
import {
  buildAdjustMetaForSlot,
  resolveSlotTransformTargets,
} from "@/lib/sheetAdjustMeta";
import {
  batchAdjustZoom,
  batchNudge,
  batchResetTransforms,
} from "@/lib/sheetAdjustSelection";
import { packSheetRecipe } from "@/utils/sheetLayoutEngine";
import { cn } from "@/lib/utils";
import type { ImageData } from "@/stores/useGalleryStore";

const NUDGE_PX = 5;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function SheetAdjustToolbar({ images }: { images: ImageData[] }) {
  const {
    printMode,
    sheetRecipe,
    sheetAlign,
    activeAdjustMeta,
    activeAdjustSlotIndex,
    selectedAdjustSlotIndices,
    getSheetSlotTransform,
    setSheetSlotTransform,
    resetSheetSlotTransform,
    showCutLines,
    setShowCutLines,
    adjustSlotSelection,
    selectAllAdjustSlots,
    setAdjustSlotSelection,
    sheetBindingMode,
    sheetSizeAssignments,
    sheetSlotAssignments,
  } = useGalleryStore();

  const resolvedPaper = useResolvedSheetPaper();

  const geometry = useMemo(
    () => packSheetRecipe(sheetRecipe, resolvedPaper, sheetAlign),
    [sheetRecipe, resolvedPaper, sheetAlign]
  );

  const bindingOptions = useMemo(
    () => ({
      bindingMode: sheetBindingMode,
      sizeAssignments: sheetSizeAssignments,
      slotAssignments: sheetSlotAssignments,
    }),
    [sheetBindingMode, sheetSizeAssignments, sheetSlotAssignments]
  );

  const effectiveSelection = useMemo(() => {
    if (selectedAdjustSlotIndices.length > 0) {
      return selectedAdjustSlotIndices;
    }
    if (activeAdjustSlotIndex !== null) return [activeAdjustSlotIndex];
    return [];
  }, [selectedAdjustSlotIndices, activeAdjustSlotIndex]);

  const batchTargets = useMemo(
    () =>
      resolveSlotTransformTargets(
        effectiveSelection,
        geometry.slots,
        images,
        bindingOptions
      ),
    [effectiveSelection, geometry.slots, images, bindingOptions]
  );

  const hasSelection = batchTargets.length > 0;
  const isMulti = batchTargets.length > 1;
  const meta = activeAdjustMeta;
  const primaryTarget = batchTargets.find(
    (t) => t.slotIndex === activeAdjustSlotIndex
  );

  const selectSlot = (slotIndex: number, e?: React.MouseEvent) => {
    const nextMeta = buildAdjustMetaForSlot(
      slotIndex,
      geometry.slots,
      images,
      bindingOptions
    );
    if (!nextMeta) return;

    adjustSlotSelection(slotIndex, geometry.slots.length, nextMeta, {
      shiftKey: e?.shiftKey,
      additive: e?.ctrlKey || e?.metaKey,
    });
  };

  const selectSamePhotoSlots = () => {
    if (!meta) return;

    const matching = resolveSlotTransformTargets(
      geometry.slots.map((s) => s.index),
      geometry.slots,
      images,
      bindingOptions
    ).filter((t) => t.filename === meta.filename);

    if (!matching.length) return;

    const indices = matching.map((t) => t.slotIndex);
    const primary = indices.includes(meta.slotIndex)
      ? meta.slotIndex
      : indices[0];

    const primaryMeta =
      buildAdjustMetaForSlot(primary, geometry.slots, images, bindingOptions) ??
      meta;

    setAdjustSlotSelection(indices, primary, primaryMeta);
  };

  const adjustZoom = (delta: number) => {
    if (!hasSelection) return;
    batchAdjustZoom(
      batchTargets,
      delta,
      getSheetSlotTransform,
      setSheetSlotTransform
    );
  };

  const nudge = (dx: number, dy: number) => {
    if (!hasSelection) return;
    batchNudge(batchTargets, dx, dy, getSheetSlotTransform, setSheetSlotTransform);
  };

  const resetSelected = () => {
    if (!hasSelection) return;
    batchResetTransforms(batchTargets, resetSheetSlotTransform);
  };

  const currentScale = primaryTarget
    ? getSheetSlotTransform(
        primaryTarget.filename,
        primaryTarget.sizeKey,
        primaryTarget.slotIndex
      ).scale
    : meta
      ? getSheetSlotTransform(meta.filename, meta.sizeKey, meta.slotIndex).scale
      : 1;

  useEffect(() => {
    if (printMode !== "sheet") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const state = useGalleryStore.getState();
      const selection =
        state.selectedAdjustSlotIndices.length > 0
          ? state.selectedAdjustSlotIndices
          : state.activeAdjustSlotIndex !== null
            ? [state.activeAdjustSlotIndex]
            : [];

      if (!selection.length) return;

      const targets = resolveSlotTransformTargets(
        selection,
        geometry.slots,
        images,
        bindingOptions
      );
      if (!targets.length) return;

      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -NUDGE_PX;
      else if (e.key === "ArrowDown") dy = NUDGE_PX;
      else if (e.key === "ArrowLeft") dx = -NUDGE_PX;
      else if (e.key === "ArrowRight") dx = NUDGE_PX;
      else return;

      e.preventDefault();
      batchNudge(
        targets,
        dx,
        dy,
        state.getSheetSlotTransform,
        state.setSheetSlotTransform
      );
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [printMode, geometry.slots, images, bindingOptions]);

  if (printMode !== "sheet") return null;

  const slotCount = geometry.slots.length;

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-2 text-xs text-white/80">
      {slotCount > 0 && (
        <div className="flex max-w-full flex-col items-center gap-1.5">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
            <span className="mr-1 text-white/50">Slot:</span>
            {geometry.slots.map((slot) => {
              const isPrimary = activeAdjustSlotIndex === slot.index;
              const isInSelection = effectiveSelection.includes(slot.index);

              return (
                <button
                  key={slot.index}
                  type="button"
                  onClick={(e) => selectSlot(slot.index, e)}
                  className={cn(
                    "min-h-[36px] min-w-[36px] rounded px-2 py-1 text-[11px] transition",
                    isPrimary
                      ? "bg-blue-600 text-white ring-2 ring-blue-300/50"
                      : isInSelection
                        ? "bg-blue-500/40 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {slot.index + 1}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => selectAllAdjustSlots(slotCount)}
              className="rounded bg-white/10 px-2 py-1 text-[11px] transition hover:bg-white/20"
            >
              Pilih semua
            </button>
            <button
              type="button"
              disabled={!meta}
              onClick={selectSamePhotoSlots}
              className="rounded bg-white/10 px-2 py-1 text-[11px] transition hover:bg-white/20 disabled:opacity-40"
            >
              Foto sama
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded bg-white/10 px-2 py-1 text-center">
          {isMulti
            ? `${batchTargets.length} slot dipilih · sesuaikan bersama`
            : meta
              ? `Slot ${meta.slotIndex + 1} · ${meta.label}`
              : "Klik slot pada lembar untuk menyesuaikan"}
        </span>

        {hasSelection && (
          <span className="rounded bg-white/10 px-2 py-1 tabular-nums">
            Zoom {Math.round(currentScale * 100)}%
            {isMulti ? " (utama)" : ""}
          </span>
        )}

        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => adjustZoom(-0.1)}
          className="flex min-h-[44px] items-center gap-1 rounded bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
          Zoom
        </button>

        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => adjustZoom(0.1)}
          className="flex min-h-[44px] items-center gap-1 rounded bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Zoom
        </button>

        <button
          type="button"
          disabled={!hasSelection}
          onClick={resetSelected}
          className="flex min-h-[44px] items-center gap-1 rounded bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset{isMulti ? " semua" : ""}
        </button>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded bg-white/10 px-2 py-1">
          <input
            type="checkbox"
            checked={showCutLines}
            onChange={(e) => setShowCutLines(e.target.checked)}
            className="accent-green-500"
          />
          Garis potong
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <span className="mr-1 text-white/50">Geser:</span>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => nudge(0, -NUDGE_PX)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
          title="Geser ke atas"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => nudge(-NUDGE_PX, 0)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
          title="Geser ke kiri"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => nudge(NUDGE_PX, 0)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
          title="Geser ke kanan"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => nudge(0, NUDGE_PX)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
          title="Geser ke bawah"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-[10px] text-white/45">
        Drag/pinch di preview (slot utama) · Ctrl+klik multi-pilih · Shift+klik
        rentang · tombol panah keyboard
      </p>
    </div>
  );
}
