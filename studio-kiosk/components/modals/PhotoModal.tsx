"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
} from "lucide-react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { cn } from "@/lib/utils";
import {
  GALLERY_PREVIEW_VARIANTS,
  hasSubjectVariant,
  hasThemedVariant,
  resolveGalleryPreviewUrl,
  type GalleryPreviewVariant,
} from "@/lib/resolveImageUrl";
import { getProcessingStatusLabel } from "@/lib/processingLabels";
import type { GalleryImageData, PackageType } from "@/lib/imageTypes";

type PhotoModalProps = {
  open: boolean;
  index: number | null;
  images: GalleryImageData[];
  packageType: PackageType;
  previewVariant: GalleryPreviewVariant;
  onPreviewVariantChange: (variant: GalleryPreviewVariant) => void;
  onClose: () => void;
  onChange: (index: number) => void;
  onRemoveBackground?: (imageId: string) => void;
  onApplyTheme?: (imageId: string) => void;
  isProcessing?: (imageId: string) => boolean;
};

function getBottomBarHeight() {
  const el = document.querySelector("[data-bottom-bar]");
  return el ? el.clientHeight : 0;
}

export function PhotoModal({
  open,
  index,
  images,
  packageType,
  previewVariant,
  onPreviewVariantChange,
  onClose,
  onChange,
  onRemoveBackground,
  onApplyTheme,
  isProcessing,
}: PhotoModalProps) {
  const { selectedForPrint, togglePrint } = useGalleryStore();
  const [bottomOffset, setBottomOffset] = useState(32);
  const [showUI, setShowUI] = useState(true);
  const [comparePos, setComparePos] = useState(55);
  const [compareMode, setCompareMode] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hideUITimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const scale = useRef(1);
  const lastScale = useRef(1);
  const startDistance = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setComparePos(55);
    setCompareMode(false);
  }, [open, index]);

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

  const resetHideUI = useCallback(() => {
    setShowUI(true);
    if (hideUITimer.current) clearTimeout(hideUITimer.current);
    hideUITimer.current = setTimeout(() => setShowUI(false), 2500);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetHideUI();
    window.addEventListener("mousemove", resetHideUI);
    window.addEventListener("keydown", resetHideUI);

    return () => {
      window.removeEventListener("mousemove", resetHideUI);
      window.removeEventListener("keydown", resetHideUI);
      if (hideUITimer.current) clearTimeout(hideUITimer.current);
    };
  }, [open, resetHideUI]);

  const resetZoom = useCallback(() => {
    scale.current = 1;
    if (imageRef.current) {
      imageRef.current.style.transform = "scale(1)";
    }
  }, []);

  useEffect(() => {
    if (!open || index === null) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (scale.current > 1) return;

      if (e.key === "ArrowRight" && index < images.length - 1) {
        resetZoom();
        onChange(index + 1);
      }
      if (e.key === "ArrowLeft" && index > 0) {
        resetZoom();
        onChange(index - 1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, images.length, onClose, onChange, resetZoom]);

  useEffect(() => {
    if (index === null) return;
    [index + 1, index - 1].forEach((i) => {
      const img = images[i];
      if (!img) return;
      const preload = new Image();
      preload.src = resolveGalleryPreviewUrl(img, packageType, previewVariant);
    });
  }, [index, images, packageType, previewVariant]);

  if (!open || index === null || !images[index]) return null;

  const image = images[index];
  const displayUrl = resolveGalleryPreviewUrl(
    image,
    packageType,
    previewVariant
  );
  const originalUrl = image.variants?.original ?? image.url;
  const themedUrl = image.variants?.themed;
  const canCompare =
    packageType === "ai-photo" &&
    Boolean(themedUrl) &&
    Boolean(originalUrl) &&
    themedUrl !== originalUrl;
  const isSelected = selectedForPrint.includes(image.filename);
  const busy = image.imageId ? isProcessing?.(image.imageId) : false;
  const canRemoveBg =
    Boolean(image.imageId && onRemoveBackground) &&
    (image.processingStatus === "none" ||
      image.processingStatus === "failed" ||
      !image.processingStatus) &&
    !busy;
  const canApplyTheme =
    Boolean(image.imageId && onApplyTheme && hasSubjectVariant(image)) &&
    image.processingStatus !== "pending" &&
    image.processingStatus !== "processing" &&
    !busy;

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    resetHideUI();

    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }

    if (e.touches.length === 2) {
      startDistance.current = getDistance(e.touches);
      lastScale.current = scale.current;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (
      e.touches.length === 2 &&
      startDistance.current &&
      imageRef.current
    ) {
      const zoom = getDistance(e.touches) / startDistance.current;
      scale.current = Math.min(Math.max(lastScale.current * zoom, 1), 4);
      imageRef.current.style.transform = `scale(${scale.current})`;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (scale.current > 1) return;
    if (touchStartX.current === null) return;

    const diff = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 60;

    if (diff > threshold && index > 0) {
      onChange(index - 1);
    }
    if (diff < -threshold && index < images.length - 1) {
      onChange(index + 1);
    }

    touchStartX.current = null;
    startDistance.current = null;
  };

  const isVariantDisabled = (variant: GalleryPreviewVariant) => {
    if (variant === "auto" || variant === "original") return false;
    if (variant === "subject") return !hasSubjectVariant(image);
    if (variant === "themed") return !hasThemedVariant(image);
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={cn(
          "fixed inset-0 z-[100] transition-opacity duration-300",
          showUI ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white/80 hover:text-white"
        >
          <X size={32} />
        </button>

        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              onChange(index - 1);
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <ChevronLeft size={48} />
          </button>
        )}

        {index < images.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              onChange(index + 1);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <ChevronRight size={48} />
          </button>
        )}

        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 max-w-[90vw]">
          {GALLERY_PREVIEW_VARIANTS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={isVariantDisabled(option.id) || compareMode}
              onClick={(e) => {
                e.stopPropagation();
                setCompareMode(false);
                onPreviewVariantChange(option.id);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs backdrop-blur transition",
                !compareMode && previewVariant === option.id
                  ? "bg-violet-600 text-white"
                  : "bg-black/60 text-white/80 hover:bg-black/80",
                (isVariantDisabled(option.id) || compareMode) &&
                  "opacity-40 cursor-not-allowed"
              )}
            >
              {option.label}
            </button>
          ))}
          {canCompare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCompareMode((v) => !v);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs backdrop-blur transition",
                compareMode
                  ? "bg-emerald-600 text-white"
                  : "bg-black/60 text-white/80 hover:bg-black/80"
              )}
            >
              Before / After
            </button>
          )}
        </div>

        {(canRemoveBg || canApplyTheme || busy) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 px-4"
            style={{ bottom: bottomOffset + 56 }}
          >
            {canApplyTheme && image.imageId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onApplyTheme?.(image.imageId!);
                }}
                className="rounded-full bg-emerald-600/90 px-4 py-2 text-sm text-white backdrop-blur hover:bg-emerald-500"
              >
                Terapkan Tema AI
              </button>
            )}
            {canRemoveBg && image.imageId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBackground?.(image.imageId!);
                }}
                className="rounded-full bg-violet-600/90 px-4 py-2 text-sm text-white backdrop-blur hover:bg-violet-500"
              >
                Hapus Background
              </button>
            )}
            {busy && (
              <span className="rounded-full bg-amber-500/80 px-4 py-2 text-sm text-white backdrop-blur">
                {getProcessingStatusLabel("processing", {
                  packageType,
                  processingPhase: image.processingPhase,
                  variants: image.variants,
                }) ?? "Memproses…"}
              </span>
            )}
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePrint(image.filename);
          }}
          style={{ bottom: bottomOffset }}
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-6 py-3 flex items-center gap-3 text-white text-lg transition-all duration-300 ease-out"
        >
          {isSelected ? (
            <>
              <CheckSquare className="text-green-400" />
              {packageType === "ai-photo"
                ? "Dipilih — siap cetak AI"
                : "Dipilih untuk cetak"}
            </>
          ) : (
            <>
              <Square />
              {packageType === "ai-photo" ? "Pilih untuk cetak AI" : "Pilih untuk cetak"}
            </>
          )}
        </button>
      </div>

      <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
        {compareMode && canCompare && themedUrl ? (
          <div className="relative inline-block max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg shadow-2xl select-none">
            <img
              src={originalUrl}
              alt="Sebelum AI"
              draggable={false}
              className="block max-h-[90vh] max-w-[90vw] object-contain"
            />
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}
            >
              <img
                src={themedUrl}
                alt="Sesudah AI"
                draggable={false}
                className="h-full w-full object-contain"
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
              style={{ left: `${comparePos}%` }}
            />
            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] tracking-wide text-white/90">
              Original
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-violet-700/90 px-2.5 py-1 text-[11px] tracking-wide text-white">
              AI
            </div>
            <input
              type="range"
              min={2}
              max={98}
              value={comparePos}
              onChange={(e) => setComparePos(Number(e.target.value))}
              className="absolute bottom-4 left-1/2 z-10 w-[min(70vw,420px)] -translate-x-1/2 accent-violet-400"
              aria-label="Geser bandingkan sebelum dan sesudah AI"
            />
          </div>
        ) : (
          <img
            ref={imageRef}
            src={displayUrl}
            alt={image.filename}
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-all duration-300 ease-out will-change-transform"
          />
        )}
      </div>
    </div>
  );
}
