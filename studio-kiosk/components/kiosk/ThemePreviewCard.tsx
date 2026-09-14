"use client";

import { Check } from "lucide-react";
import type { AiTheme } from "@/lib/imageTypes";
import {
  AI_IDENTITY_COPY,
  getAiThemeStyleLabel,
  isAiThemeSelectable,
} from "@/lib/aiUiCopy";
import { cn } from "@/lib/utils";

type ThemePreviewCardProps = {
  theme: AiTheme;
  selected: boolean;
  onSelect: () => void;
  onExpand?: () => void;
};

export function ThemePreviewCard({
  theme,
  selected,
  onSelect,
  onExpand,
}: ThemePreviewCardProps) {
  const selectable = isAiThemeSelectable(theme);
  const styleLabel = getAiThemeStyleLabel(theme);
  const hasBeforeAfter = Boolean(theme.previewUrl && theme.previewBeforeUrl);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white/5 text-left transition",
        !selectable && "opacity-55",
        selected && selectable
          ? "border-[#B59240]/60 ring-2 ring-[#B59240]/45"
          : "border-white/10 hover:border-white/25 hover:bg-white/[0.07]"
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!selectable) return;
          if (onExpand) {
            onExpand();
            return;
          }
          onSelect();
        }}
        disabled={!selectable}
        className="block w-full text-left disabled:cursor-not-allowed"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/30">
          {hasBeforeAfter ? (
            <div className="flex h-full">
              <div className="relative w-1/2">
                <img
                  src={theme.previewBeforeUrl!}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                  Asli
                </span>
              </div>
              <div className="relative w-1/2">
                <img
                  src={theme.previewUrl!}
                  alt={theme.label}
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
                  Hasil
                </span>
              </div>
            </div>
          ) : theme.previewUrl ? (
            <img
              src={theme.previewUrl}
              alt={theme.label}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-white/45"
              style={{ backgroundColor: theme.previewColor }}
            >
              Preview belum siap
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1 p-2">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
              {styleLabel}
            </span>
            {theme.seasonal ? (
              <span className="rounded-full bg-amber-500/85 px-2 py-0.5 text-[10px] font-medium text-white">
                Musiman
              </span>
            ) : null}
          </div>

          {selected && selectable ? (
            <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-[#B59240] p-1 text-black shadow-lg">
              <Check className="size-4" />
            </div>
          ) : null}
        </div>

        <div className="space-y-1 p-3">
          <p className="text-sm font-semibold text-white">{theme.label}</p>
          <p className="line-clamp-2 text-[11px] leading-snug text-white/50">
            {selectable ? theme.description : "Preview atau background tema belum lengkap."}
          </p>
        </div>
      </button>
    </article>
  );
}

export function ThemePreviewCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <div className="aspect-[3/4] animate-pulse bg-white/10" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}

export function ThemePickerHint() {
  return (
    <p className="text-xs leading-relaxed text-white/55">{AI_IDENTITY_COPY}</p>
  );
}
