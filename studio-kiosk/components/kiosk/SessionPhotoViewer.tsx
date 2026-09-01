"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImageData } from "@/lib/imageTypes";
import { getOriginalPreviewUrl } from "@/lib/aiGalleryUtils";
import { getProcessingStatusLabel } from "@/lib/processingLabels";

type SessionPhotoViewerProps = {
  open: boolean;
  images: GalleryImageData[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
};

export function SessionPhotoViewer({
  open,
  images,
  index,
  onClose,
  onChange,
}: SessionPhotoViewerProps) {
  const image = images[index] ?? null;
  const src = image ? getOriginalPreviewUrl(image) : null;
  const statusLabel = getProcessingStatusLabel(image?.processingStatus);
  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && canPrev) onChange(index - 1);
      if (event.key === "ArrowRight" && canNext) onChange(index + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, canPrev, canNext, onChange, onClose]);

  if (!open || !image || !src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detail foto sesi"
      className="fixed inset-0 z-[80] flex flex-col bg-black/92"
    >
      <header className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 truncate text-sm text-white/80">
          Foto {index + 1} dari {images.length}
          <span className="ml-2 text-white/40">{image.filename}</span>
        </p>
        {statusLabel ? (
          <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] text-white">
            {statusLabel}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
          aria-label="Tutup"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={image.filename}
          className="absolute inset-0 size-full object-contain"
        />

        {canPrev ? (
          <button
            type="button"
            onClick={() => onChange(index - 1)}
            className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white hover:bg-black/70"
            aria-label="Foto sebelumnya"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : null}

        {canNext ? (
          <button
            type="button"
            onClick={() => onChange(index + 1)}
            className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white hover:bg-black/70"
            aria-label="Foto berikutnya"
          >
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>

      {image.processingError ? (
        <p className="shrink-0 px-4 py-3 text-center text-xs text-red-300 sm:px-6">
          {image.processingError}
        </p>
      ) : (
        <p className="shrink-0 px-4 py-3 text-center text-xs text-white/40 sm:px-6">
          Geser kiri/kanan atau panah keyboard untuk melihat riwayat foto
        </p>
      )}
    </div>
  );
}
