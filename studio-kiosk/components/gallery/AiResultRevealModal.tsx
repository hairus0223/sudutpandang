"use client";

import { useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { BeforeAfterReveal } from "@/components/gallery/BeforeAfterReveal";

type AiResultRevealModalProps = {
  open: boolean;
  beforeSrc: string;
  afterSrc: string;
  filename?: string;
  themeLabel?: string | null;
  autoReveal?: boolean;
  onClose: () => void;
};

export function AiResultRevealModal({
  open,
  beforeSrc,
  afterSrc,
  filename,
  themeLabel,
  autoReveal = true,
  onClose,
}: AiResultRevealModalProps) {
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-1 -top-12 text-white/70 transition hover:text-white"
          aria-label="Tutup"
        >
          <X size={32} />
        </button>

        <div className="mb-3 flex items-center gap-2 text-violet-200">
          <Sparkles className="size-4" />
          <span className="text-sm font-medium">
            {themeLabel ? `Hasil AI · ${themeLabel}` : "Hasil AI siap!"}
          </span>
        </div>

        <BeforeAfterReveal
          beforeSrc={beforeSrc}
          afterSrc={afterSrc}
          autoReveal={autoReveal}
          className="rounded-2xl border border-white/10 shadow-2xl"
        />

        <p className="mt-3 text-center text-xs text-white/45">
          Geser untuk bandingkan · {filename ?? "Foto"}
        </p>
      </div>
    </div>
  );
}
