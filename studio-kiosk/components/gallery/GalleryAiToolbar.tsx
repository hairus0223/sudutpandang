"use client";

import { useRef, useState } from "react";
import { ChevronDown, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toUiThemeOptions } from "@/lib/aiThemes";
import {
  GALLERY_PREVIEW_VARIANTS,
  type GalleryPreviewVariant,
} from "@/lib/resolveImageUrl";
import type { PackageType, ThemeGroup } from "@/lib/imageTypes";

type GalleryAiToolbarProps = {
  packageType: PackageType;
  sessionThemeId?: string;
  selectedThemeId: string;
  onThemeChange: (themeId: string) => void;
  onUpload: (file: File) => void;
  uploading?: boolean;
  previewVariant: GalleryPreviewVariant;
  onPreviewVariantChange: (variant: GalleryPreviewVariant) => void;
  themeGroups: ThemeGroup[];
  themesLoading?: boolean;
  isBusy?: boolean;
  processingCount?: number;
  defaultCollapsed?: boolean;
};

const PACKAGE_LABELS: Record<PackageType, string> = {
  "self-photo": "Self Photo",
  "pas-photo": "Pas Photo",
  "ai-photo": "AI Photo",
};

export function GalleryAiToolbar({
  packageType,
  sessionThemeId,
  selectedThemeId,
  onThemeChange,
  onUpload,
  uploading = false,
  previewVariant,
  onPreviewVariantChange,
  themeGroups,
  themesLoading = false,
  isBusy = false,
  processingCount = 0,
  defaultCollapsed = true,
}: GalleryAiToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const allUiThemes = themeGroups.flatMap((group) =>
    toUiThemeOptions(group.themes)
  );
  const totalThemes = allUiThemes.length;
  const sessionThemeLabel =
    allUiThemes.find((theme) => theme.id === sessionThemeId)?.label ??
    sessionThemeId;

  return (
    <section className="mb-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setCollapsed((open) => !open)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-white/50 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
          <div className="min-w-0">
            <p className="text-xs tracking-[0.22em] text-white/50 uppercase">
              {packageType === "ai-photo"
                ? "Galeri AI Photo"
                : "Galeri & AI Tools"}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {packageType === "ai-photo" ? (
                <>
                  Bandingkan hasil, pilih favorit, lalu cetak. Paket:{" "}
                  <span className="font-semibold text-white">AI Photo</span>
                  {sessionThemeLabel && (
                    <>
                      {" "}
                      · Tema:{" "}
                      <span className="text-violet-200">{sessionThemeLabel}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  Paket:{" "}
                  <span className="font-semibold text-white">
                    {PACKAGE_LABELS[packageType]}
                  </span>
                </>
              )}
              {collapsed && !themesLoading && (
                <span className="text-white/45">
                  {" "}
                  · {totalThemes} tema ·{" "}
                  {GALLERY_PREVIEW_VARIANTS.find((v) => v.id === previewVariant)
                    ?.label ?? "Auto"}
                </span>
              )}
            </p>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || isBusy}
            className="border-white/20 bg-black/40 text-white hover:bg-white/10"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Mengunggah…" : "Upload Uji"}
          </Button>
        </div>
      </div>

      {processingCount > 0 && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 sm:px-4">
          {processingCount === 1
            ? "1 foto sedang diproses AI…"
            : `${processingCount} foto sedang diproses AI…`}
        </div>
      )}

      {!collapsed && (
        <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="space-y-3">
            <label className="flex items-center gap-1.5 text-xs tracking-[0.18em] text-white/50 uppercase">
              <Sparkles className="size-3.5" />
              Tema untuk foto baru / ganti tema
            </label>
            {themesLoading ? (
              <p className="text-xs text-white/50">Memuat tema…</p>
            ) : (
              <div className="space-y-3">
                {themeGroups.map((group) => {
                  const groupUi = toUiThemeOptions(group.themes);

                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] tracking-[0.18em] text-white/45 uppercase">
                          {group.label}
                        </p>
                        {!group.assetsReady && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                            Asset belum lengkap
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "grid gap-2",
                          group.pickerCompact
                            ? "grid-cols-3 sm:grid-cols-5"
                            : "grid-cols-2 sm:grid-cols-4"
                        )}
                      >
                        {groupUi.map((theme) => (
                          <ThemeChip
                            key={theme.id}
                            label={theme.label}
                            preview={theme.preview}
                            assetAvailable={theme.assetAvailable}
                            selected={selectedThemeId === theme.id}
                            disabled={isBusy}
                            onClick={() => onThemeChange(theme.id)}
                            compact={group.pickerCompact}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs tracking-[0.18em] text-white/50 uppercase">
              {packageType === "ai-photo"
                ? "Tampilan grid (coba Bertema vs Original)"
                : "Tampilan grid"}
            </label>
            <div className="flex flex-wrap gap-2">
              {GALLERY_PREVIEW_VARIANTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onPreviewVariantChange(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs transition",
                    previewVariant === option.id
                      ? "bg-violet-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/15"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {packageType === "ai-photo" && (
              <p className="text-[11px] text-white/45">
                Tip: buka foto → geser Before/After untuk wow moment customer.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ThemeChip({
  label,
  preview,
  assetAvailable,
  selected,
  disabled,
  onClick,
  compact = false,
}: {
  label: string;
  preview: string;
  assetAvailable: boolean;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-[11px] transition",
        selected
          ? "border-violet-400 bg-violet-500/20 text-white"
          : "border-white/15 bg-black/30 text-white/70 hover:bg-white/10",
        compact && "py-1.5"
      )}
    >
      <span
        className={cn(
          "w-full rounded-md border border-white/20",
          compact ? "h-6" : "h-8"
        )}
        style={{ background: preview }}
      />
      <span className="w-full truncate text-center">{label}</span>
      {assetAvailable ? (
        <span
          className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400"
          title="Asset offline tersedia"
        />
      ) : (
        <span
          className="absolute right-1 top-1 rounded bg-amber-500/80 px-1 text-[8px] text-white"
          title="Butuh API/cache"
        >
          API
        </span>
      )}
    </button>
  );
}
