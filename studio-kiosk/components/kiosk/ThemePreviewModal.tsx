"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { AiTheme } from "@/lib/imageTypes";
import { BeforeAfterReveal } from "@/components/gallery/BeforeAfterReveal";
import { ThemePickerHint } from "@/components/kiosk/ThemePreviewCard";
import { Button } from "@/components/ui/button";
import { getAiThemeStyleLabel, isAiThemeSelectable } from "@/lib/aiUiCopy";

type ThemePreviewModalProps = {
  theme: AiTheme | null;
  open: boolean;
  onClose: () => void;
  onSelect?: (themeId: string) => void;
};

export function ThemePreviewModal({
  theme,
  open,
  onClose,
  onSelect,
}: ThemePreviewModalProps) {
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

  if (!open || !theme) return null;

  const hasBeforeAfter = Boolean(theme.previewUrl && theme.previewBeforeUrl);
  const selectable = isAiThemeSelectable(theme);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
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

        <div className="mb-3">
          <h3 className="text-lg font-semibold text-white">{theme.label}</h3>
          <p className="mt-1 text-sm text-white/55">{theme.description}</p>
          <p className="mt-1 text-[11px] text-white/40">
            {getAiThemeStyleLabel(theme)}
          </p>
        </div>

        <ThemePickerHint />

        <div className="mt-4">
          {hasBeforeAfter ? (
            <BeforeAfterReveal
              beforeSrc={theme.previewBeforeUrl!}
              afterSrc={theme.previewUrl!}
              autoReveal
              className="rounded-2xl border border-white/10 shadow-2xl"
            />
          ) : theme.previewUrl ? (
            <img
              src={theme.previewUrl}
              alt={theme.label}
              className="aspect-[3/4] w-full rounded-2xl border border-white/10 object-cover shadow-2xl"
            />
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-white/5 text-sm text-white/45">
              Preview belum siap
            </div>
          )}
        </div>

        {onSelect ? (
          <Button
            type="button"
            className="mt-4 h-11 w-full bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
            disabled={!selectable}
            onClick={() => {
              onSelect(theme.id);
              onClose();
            }}
          >
            Pilih tema ini
          </Button>
        ) : null}
      </div>
    </div>
  );
}
