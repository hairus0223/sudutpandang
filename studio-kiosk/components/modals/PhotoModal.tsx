"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import {
  canGenerateAiSelection,
  getAiSelectionStatus,
  getAiSelectionStatusLabel,
} from "@/lib/aiGalleryUtils";
import {
  hasAiPrintVariant,
  resolveGalleryPreviewUrl,
  resolvePrintUrl,
} from "@/lib/resolveImageUrl";
import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";
import {
  btnIcon,
  btnNeutral,
  btnPrimary,
  btnPrint,
  btnSegment,
  btnSuccess,
  btnWarning,
} from "@/lib/galleryUiStyles";
import { cn } from "@/lib/utils";

type PhotoModalProps = {
  open: boolean;
  index: number | null;
  images: GalleryImageData[];
  onClose: () => void;
  onChange: (index: number) => void;
  aiMode?: boolean;
  selectedImageIds?: string[];
  onToggleGallerySelection?: (imageId: string) => void;
  onGenerateAi?: (imageId: string) => void | Promise<void>;
  generating?: boolean;
};

function getBottomBarHeight() {
  const el = document.querySelector("[data-bottom-bar]");
  return el ? el.clientHeight : 0;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function PhotoModal({
  open,
  index,
  images,
  onClose,
  onChange,
  aiMode = false,
  selectedImageIds = [],
  onToggleGallerySelection,
  onGenerateAi,
  generating = false,
}: PhotoModalProps) {
  const {
    selectedForPrint,
    togglePrint,
    printVariantByFilename,
    aiThemeId,
    packageType,
  } = useGalleryStore();
  const [bottomOffset, setBottomOffset] = useState(32);
  const [showUI, setShowUI] = useState(true);
  const [viewVariant, setViewVariant] = useState<PrintVariant>("original");
  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hideUITimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const scale = useRef(1);
  const lastScale = useRef(1);
  const startDistance = useRef<number | null>(null);
  const panX = useRef(0);
  const panY = useRef(0);
  const lastPan = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    if (!imageRef.current) return;
    imageRef.current.style.transform = `translate(${panX.current}px, ${panY.current}px) scale(${scale.current})`;
  }, []);

  const resetZoom = useCallback(() => {
    scale.current = 1;
    lastScale.current = 1;
    panX.current = 0;
    panY.current = 0;
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    if (!open) return;
    setBottomOffset(getBottomBarHeight() + 24);
  }, [open, selectedForPrint.length]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open || index === null || !images[index]) return;
    const filename = images[index].filename;
    setViewVariant(printVariantByFilename[filename] ?? "original");
    resetZoom();
  }, [open, index, images, printVariantByFilename, resetZoom]);

  const resetHideUI = useCallback(() => {
    setShowUI(true);
    if (hideUITimer.current) clearTimeout(hideUITimer.current);
    hideUITimer.current = setTimeout(() => setShowUI(false), 4000);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetHideUI();
    window.addEventListener("mousemove", resetHideUI);
    window.addEventListener("keydown", resetHideUI);
    window.addEventListener("touchstart", resetHideUI, { passive: true });

    return () => {
      window.removeEventListener("mousemove", resetHideUI);
      window.removeEventListener("keydown", resetHideUI);
      window.removeEventListener("touchstart", resetHideUI);
      if (hideUITimer.current) clearTimeout(hideUITimer.current);
    };
  }, [open, resetHideUI]);

  useEffect(() => {
    if (!open || index === null) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onChange(index - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) onChange(index + 1);
      if (e.key === "+" || e.key === "=") {
        scale.current = Math.min(MAX_SCALE, scale.current + 0.25);
        applyTransform();
      }
      if (e.key === "-") {
        scale.current = Math.max(MIN_SCALE, scale.current - 0.25);
        if (scale.current <= 1) {
          panX.current = 0;
          panY.current = 0;
        }
        applyTransform();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, images.length, onClose, onChange, applyTransform]);

  useEffect(() => {
    if (!open || !viewportRef.current) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      scale.current = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.current + delta));
      if (scale.current <= 1) {
        panX.current = 0;
        panY.current = 0;
      }
      applyTransform();
      resetHideUI();
    };

    const el = viewportRef.current;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, applyTransform, resetHideUI]);

  if (!open || index === null || !images[index]) return null;

  const image = images[index];
  const selectionKey = image.imageId ?? image.filename;
  const canSwitchVariant =
    packageType === "ai-self-photo" && hasAiPrintVariant(image, aiThemeId);
  const printTargetVariant = canSwitchVariant ? viewVariant : "original";
  const displayUrl = canSwitchVariant
    ? resolvePrintUrl(image, viewVariant, aiThemeId)
    : resolveGalleryPreviewUrl(image);
  const isPrintSelected = selectedForPrint.includes(image.filename);
  const selectedVariant = printVariantByFilename[image.filename] ?? "original";
  const isPrintActive =
    isPrintSelected && selectedVariant === printTargetVariant;
  const isGallerySelected = selectedImageIds.includes(selectionKey);
  const aiStatus = aiMode ? getAiSelectionStatus(image) : null;
  const aiStatusLabel = getAiSelectionStatusLabel(aiStatus);
  const canGenerate = aiMode && canGenerateAiSelection(aiStatus);
  const isAiReady = aiStatus === "ready";
  const isAiFailed = aiStatus === "failed";
  const isAiProcessing = ["pending", "queued", "processing"].includes(aiStatus || "");

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      startDistance.current = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
      lastScale.current = scale.current;
    } else if (e.touches.length === 1) {
      if (scale.current > 1) {
        isPanning.current = true;
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastPan.current = { x: panX.current, y: panY.current };
      } else {
        touchStartX.current = e.touches[0].clientX;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && startDistance.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
      scale.current = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, (dist / startDistance.current) * lastScale.current)
      );
      applyTransform();
    } else if (e.touches.length === 1 && isPanning.current && scale.current > 1) {
      panX.current = lastPan.current.x + (e.touches[0].clientX - panStart.current.x);
      panY.current = lastPan.current.y + (e.touches[0].clientY - panStart.current.y);
      applyTransform();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
    } else if (
      scale.current <= 1.05 &&
      touchStartX.current !== null &&
      e.changedTouches.length === 1
    ) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 80) {
        if (dx > 0 && index > 0) onChange(index - 1);
        if (dx < 0 && index < images.length - 1) onChange(index + 1);
      }
    }
    touchStartX.current = null;
    startDistance.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale.current <= 1) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    lastPan.current = { x: panX.current, y: panY.current };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current || scale.current <= 1) return;
    panX.current = lastPan.current.x + (e.clientX - panStart.current.x);
    panY.current = lastPan.current.y + (e.clientY - panStart.current.y);
    applyTransform();
  };

  const handleMouseUp = () => {
    isPanning.current = false;
  };

  const zoomIn = () => {
    scale.current = Math.min(MAX_SCALE, scale.current + 0.5);
    applyTransform();
    resetHideUI();
  };

  const zoomOut = () => {
    scale.current = Math.max(MIN_SCALE, scale.current - 0.5);
    if (scale.current <= 1) {
      panX.current = 0;
      panY.current = 0;
    }
    applyTransform();
    resetHideUI();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Preview foto"
    >
      {/* Backdrop — tap area to close */}
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Tutup preview"
        onClick={onClose}
      />

      {/* Image layer — behind controls, only image captures pointer events */}
      <div
        ref={viewportRef}
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <img
          ref={imageRef}
          src={displayUrl}
          alt={image.filename}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (scale.current > 1) resetZoom();
            else {
              scale.current = 2;
              applyTransform();
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="pointer-events-auto max-h-[78vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl will-change-transform cursor-zoom-in"
          style={{ transform: "scale(1)" }}
        />
      </div>

      {/* Controls layer — always above image */}
      <div
        className={cn(
          "absolute inset-0 z-40 transition-opacity duration-300",
          showUI ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-black/80 to-transparent p-4 sm:p-6">
          <div className="min-w-0 pt-1">
            <p className="truncate text-sm text-white/90">{image.filename}</p>
            <p className="text-xs text-white/60">
              {index + 1} / {images.length}
              {aiStatusLabel ? ` · ${aiStatusLabel}` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomOut();
              }}
              className={btnIcon()}
              aria-label="Perkecil"
            >
              <ZoomOut className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zoomIn();
              }}
              className={btnIcon()}
              aria-label="Perbesar"
            >
              <ZoomIn className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className={cn(btnIcon(), "hover:border-red-400/70 hover:text-red-200")}
              aria-label="Tutup"
            >
              <X className="size-8" />
            </button>
          </div>
        </div>

        {/* Prev / next */}
        {index > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              onChange(index - 1);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 transition hover:text-white sm:left-6"
            aria-label="Foto sebelumnya"
          >
            <ChevronLeft className="size-10 sm:size-12" />
          </button>
        )}

        {index < images.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              onChange(index + 1);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition hover:text-white sm:right-6"
            aria-label="Foto berikutnya"
          >
            <ChevronRight className="size-10 sm:size-12" />
          </button>
        )}

        {/* AI status pill */}
        {aiMode && aiStatus ? (
          <div className="pointer-events-none absolute left-1/2 top-[4.5rem] -translate-x-1/2 sm:top-20">
            {isAiReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <CheckCircle2 className="size-3.5" />
                AI selesai
              </span>
            ) : isAiFailed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <AlertCircle className="size-3.5" />
                Generate gagal
              </span>
            ) : isAiProcessing ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                <Loader2 className="size-3.5 animate-spin" />
                Sedang diproses…
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Bottom action panel */}
        <div
          style={{ bottom: bottomOffset }}
          className="absolute left-1/2 flex w-[min(100%,42rem)] -translate-x-1/2 flex-col items-center gap-4 px-4"
        >
          {canSwitchVariant ? (
            <div className="flex gap-1.5 rounded-xl border-2 border-white/25 bg-black/70 p-1.5 backdrop-blur-md">
              {(["original", "ai"] as const).map((variant) => (
                <button
                  key={variant}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewVariant(variant);
                    resetZoom();
                  }}
                  className={btnSegment(
                    viewVariant === variant,
                    variant === "ai" ? "ai" : "original"
                  )}
                >
                  {variant === "ai" ? "AI" : "Asli"}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {onToggleGallerySelection ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleGallerySelection(selectionKey);
                }}
                className={cn(
                  btnNeutral(isGallerySelected),
                  "flex-1 sm:flex-none",
                  isGallerySelected &&
                    (aiMode
                      ? "!border-violet-300 !text-violet-100"
                      : "!border-[#E8C872] !text-[#E8C872]")
                )}
              >
                {isGallerySelected ? (
                  <CheckSquare className="size-4 text-current" />
                ) : (
                  <Square className="size-4" />
                )}
                {isGallerySelected ? "Terpilih" : "Pilih foto"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePrint(image.filename, printTargetVariant);
              }}
              className={cn(
                isPrintActive ? btnPrint(true) : btnPrint(false),
                "flex-1 px-6 py-3 text-base sm:flex-none"
              )}
            >
              {isPrintActive ? (
                <CheckSquare className="size-5" />
              ) : (
                <Square className="size-5" />
              )}
              {isPrintActive
                ? `Batalkan cetak (${printTargetVariant === "ai" ? "AI" : "Asli"})`
                : `Cetak ${printTargetVariant === "ai" ? "AI" : "asli"}`}
            </button>

            {aiMode && onGenerateAi && selectionKey ? (
              isAiReady ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewVariant("ai");
                    resetZoom();
                  }}
                  className={cn(btnSuccess(), "flex-1 sm:flex-none")}
                >
                  <CheckCircle2 className="size-4" />
                  Lihat AI
                </button>
              ) : isAiProcessing ? (
                <span
                  className={cn(
                    btnWarning(true),
                    "flex-1 cursor-default sm:flex-none"
                  )}
                >
                  <Loader2 className="size-4 animate-spin" />
                  Proses…
                </span>
              ) : isAiFailed ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onGenerateAi(selectionKey);
                  }}
                  disabled={generating}
                  className={cn(btnWarning(), "flex-1 sm:flex-none")}
                >
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Coba lagi
                </button>
              ) : canGenerate ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onGenerateAi(selectionKey);
                  }}
                  disabled={generating}
                  className={cn(btnPrimary(), "flex-1 sm:flex-none")}
                >
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Generate AI
                </button>
              ) : null
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((thumb, thumbIndex) => {
                const thumbUrl = resolveGalleryPreviewUrl(thumb);
                const isActive = thumbIndex === index;
                const thumbKey = thumb.imageId ?? thumb.filename;
                const thumbSelected = selectedImageIds.includes(thumbKey);
                return (
                  <button
                    key={thumb.filename}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetZoom();
                      onChange(thumbIndex);
                    }}
                    className={cn(
                      "relative h-14 w-11 shrink-0 overflow-hidden rounded-lg ring-2 transition",
                      isActive ? "ring-violet-400" : "ring-white/15 hover:ring-white/35"
                    )}
                  >
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {thumbSelected ? (
                      <span className="absolute inset-0 bg-violet-500/25 ring-1 ring-inset ring-violet-300/60" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
