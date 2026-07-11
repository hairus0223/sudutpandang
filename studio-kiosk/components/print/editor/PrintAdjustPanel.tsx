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
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelSection } from "./printEditorUi";

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

export function PrintAdjustPanel({ images }: { images: ImageData[] }) {
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

  if (printMode !== "sheet") {
    return (
      <p className="text-sm text-white/50">
        Penyesuaian slot hanya untuk mode Cetak Lembar.
      </p>
    );
  }

  const slotCount = geometry.slots.length;

  return (
    <div className="flex flex-col gap-4">
      {!hasSelection ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center">
          <p className="text-sm text-white/70">Belum ada slot dipilih</p>
          <p className="mt-1 text-[11px] text-white/45">
            Klik slot di preview atau pilih nomor di bawah
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-sm font-medium text-white">
            {isMulti
              ? `${batchTargets.length} slot dipilih`
              : meta
                ? `Slot ${meta.slotIndex + 1}`
                : "Slot aktif"}
          </p>
          {meta && !isMulti ? (
            <p className="text-[11px] text-white/50">{meta.label}</p>
          ) : null}
          {isMulti ? (
            <p className="text-[11px] text-white/50">Sesuaikan bersama</p>
          ) : null}
          <p className="mt-1 text-xs tabular-nums text-violet-200/90">
            Zoom {Math.round(currentScale * 100)}%
          </p>
        </div>
      )}

      {slotCount > 0 ? (
        <PanelSection title="Pilih slot">
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {geometry.slots.map((slot) => {
              const isPrimary = activeAdjustSlotIndex === slot.index;
              const isInSelection = effectiveSelection.includes(slot.index);
              return (
                <button
                  key={slot.index}
                  type="button"
                  onClick={(e) => selectSlot(slot.index, e)}
                  className={cn(
                    "min-h-[40px] rounded-md text-xs font-medium transition",
                    isPrimary
                      ? "bg-blue-600 text-white ring-2 ring-blue-400/40"
                      : isInSelection
                        ? "bg-blue-500/35 text-white"
                        : "bg-white/10 text-white/75 hover:bg-white/20"
                  )}
                >
                  {slot.index + 1}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectAllAdjustSlots(slotCount)}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              Semua
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!meta}
              onClick={selectSamePhotoSlots}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              Foto sama
            </Button>
          </div>
        </PanelSection>
      ) : null}

      <PanelSection title="Zoom">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={() => adjustZoom(-0.1)}
            className="min-h-[44px] flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={() => adjustZoom(0.1)}
            className="min-h-[44px] flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={resetSelected}
            className="min-h-[44px] border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Geser posisi">
        <div className="mx-auto grid w-fit grid-cols-3 gap-1">
          <span />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasSelection}
            onClick={() => nudge(0, -NUDGE_PX)}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <span />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasSelection}
            onClick={() => nudge(-NUDGE_PX, 0)}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center justify-center text-[10px] text-white/40">
            {NUDGE_PX}px
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasSelection}
            onClick={() => nudge(NUDGE_PX, 0)}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <span />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasSelection}
            onClick={() => nudge(0, NUDGE_PX)}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <span />
        </div>
      </PanelSection>

      <p className="text-[10px] leading-relaxed text-white/40">
        Drag/pinch di preview mengubah slot utama (biru tebal). Ctrl+klik
        multi-pilih · Shift+klik rentang · tombol panah keyboard.
      </p>
    </div>
  );
}
