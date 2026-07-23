"use client";

import { Check, Sparkles } from "lucide-react";
import type { AiTheme, AiThemeType } from "@/lib/imageTypes";
import { cn } from "@/lib/utils";

type ThemePreviewCardProps = {
  theme: AiTheme;
  selected: boolean;
  onSelect: () => void;
  onExpand?: () => void;
};

function getTypeBadge(type: AiThemeType): { label: string; className: string } {
  if (type === "transform") {
    return {
      label: "Transform",
      className: "bg-violet-600/85 text-white",
    };
  }
  return {
    label: "Latar Premium",
    className: "bg-black/60 text-white/90",
  };
}

export function ThemePreviewCard({
  theme,
  selected,
  onSelect,
  onExpand,
}: ThemePreviewCardProps) {
  const typeBadge = getTypeBadge(theme.type);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white/5 text-left transition",
        selected
          ? "border-[#B59240]/60 ring-2 ring-[#B59240]/45"
          : "border-white/10 hover:border-white/25 hover:bg-white/[0.07]"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/30">
          {theme.previewUrl ? (
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
              className="h-full w-full"
              style={{ backgroundColor: theme.previewColor }}
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1 p-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur",
                typeBadge.className
              )}
            >
              {typeBadge.label}
            </span>
            {theme.seasonal ? (
              <span className="rounded-full bg-amber-500/85 px-2 py-0.5 text-[10px] font-medium text-white">
                Musiman
              </span>
            ) : null}
          </div>

          {selected ? (
            <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-[#B59240] p-1 text-black shadow-lg">
              <Check className="size-4" />
            </div>
          ) : null}
        </div>

        <div className="space-y-1 p-3">
          <p className="text-sm font-semibold text-white">{theme.label}</p>
          <p className="line-clamp-2 text-[11px] leading-snug text-white/50">
            {theme.description}
          </p>
        </div>
      </button>

      {onExpand && theme.previewUrl ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur transition hover:bg-black/80"
        >
          Lihat contoh
        </button>
      ) : null}
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

export function ThemePickerHint({ type }: { type?: AiThemeType }) {
  if (type === "transform") {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-violet-200/90">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
        Transform: foto diubah seperti contoh (wajah & pose tetap sama).
      </p>
    );
  }
  return (
    <p className="text-xs leading-relaxed text-white/50">
      Latar premium: baju asli tetap, background berubah seperti contoh.
    </p>
  );
}
