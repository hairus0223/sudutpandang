"use client";

import { useRef, type ChangeEvent } from "react";
import { ChevronDown, ImageIcon, Loader2, Upload } from "lucide-react";
import type { CostumePreset, DraftInput } from "@/lib/aiThemeResearchTypes";
import { btnNeutral, galleryPanelClass } from "@/lib/galleryUiStyles";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-xl border-2 border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet-400/60";

type ThemeStudioDraftPanelProps = {
  form: DraftInput;
  onChange: (next: DraftInput) => void;
  costumePresets: CostumePreset[];
  backgroundUrl?: string | null;
  backgroundReady?: boolean;
  uploadingBackground?: boolean;
  onUploadBackground: (file: File) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onTitleChange?: (title: string) => void;
};

export function ThemeStudioDraftPanel({
  form,
  onChange,
  costumePresets,
  backgroundUrl,
  backgroundReady = false,
  uploadingBackground = false,
  onUploadBackground,
  showAdvanced,
  onToggleAdvanced,
  onTitleChange,
}: ThemeStudioDraftPanelProps) {
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleBgPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onUploadBackground(file);
  };

  const selectedPreset =
    costumePresets.find((preset) => preset.id === form.costumePresetId) ??
    costumePresets[0];

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm">
        <span className="text-white/65">Nama tema</span>
        <input
          className={fieldClass}
          value={form.workingTitle}
          onChange={(e) => {
            const value = e.target.value;
            onChange({ ...form, workingTitle: value, label: value, description: value });
            onTitleChange?.(value);
          }}
          placeholder="Contoh: Viking Warrior"
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-white/65">Background foto (3:4 portrait)</span>
          <button
            type="button"
            className={btnNeutral(false, "px-3 py-1.5 text-xs")}
            disabled={uploadingBackground}
            onClick={() => bgInputRef.current?.click()}
          >
            {uploadingBackground ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {backgroundReady ? "Ganti bg" : "Upload bg"}
          </button>
          <input
            ref={bgInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleBgPick}
          />
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-xl border",
            backgroundReady ? "border-emerald-400/30" : "border-amber-400/30"
          )}
        >
          {backgroundUrl ? (
            <img
              src={backgroundUrl}
              alt="Background draft"
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 bg-black/30 text-white/40">
              <ImageIcon className="size-8" />
              <p className="text-xs">Upload background tanpa orang</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-white/65">Pipeline booth</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                id: "composite-costume",
                label: "Composite + Kostum AI",
                hint: "Segment → kostum masked → composite",
              },
              {
                id: "composite-only",
                label: "Composite saja",
                hint: "Segment → composite (tanpa OpenAI)",
              },
            ] as const
          ).map((mode) => {
            const active = form.pipelineMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChange({ ...form, pipelineMode: mode.id })}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition",
                  active
                    ? "border-violet-400/70 bg-violet-500/10"
                    : "border-white/10 hover:border-white/25"
                )}
              >
                <p className="text-sm font-medium text-white/90">{mode.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">{mode.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-white/65">Preset kostum</span>
        <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {costumePresets.map((preset) => {
            const active = form.costumePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...form,
                    costumePresetId: preset.id,
                    previewColor: preset.previewColor,
                    promptMode: "studio",
                  })
                }
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition",
                  active
                    ? "border-violet-400/70 bg-violet-500/10"
                    : "border-white/10 hover:border-white/25"
                )}
              >
                <span
                  className="mb-2 inline-block size-3 rounded-full"
                  style={{ backgroundColor: preset.previewColor }}
                />
                <p className="text-sm font-medium text-white/90">{preset.label}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-white/50">
                  {preset.description}
                </p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() =>
              onChange({ ...form, costumePresetId: "custom", promptMode: "studio" })
            }
            className={cn(
              "rounded-xl border-2 border-dashed p-3 text-left transition",
              form.costumePresetId === "custom"
                ? "border-violet-400/70 bg-violet-500/10"
                : "border-white/15 hover:border-white/30"
            )}
          >
            <p className="text-sm font-medium text-white/90">Custom wardrobe</p>
            <p className="mt-1 text-[11px] text-white/50">Tulis deskripsi pakaian sendiri</p>
          </button>
        </div>
      </div>

      {form.costumePresetId === "custom" ? (
        <label className="block space-y-1.5 text-sm">
          <span className="text-white/65">Deskripsi kostum (wardrobe only)</span>
          <textarea
            className={cn(fieldClass, "min-h-[96px] resize-y")}
            value={form.customWardrobe ?? ""}
            onChange={(e) => onChange({ ...form, customWardrobe: e.target.value })}
            placeholder="Contoh: Elegant medieval knight armor with red cape, leather belt, no weapons."
          />
        </label>
      ) : selectedPreset ? (
        <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55">
          Kostum dari preset <strong className="text-white/80">{selectedPreset.label}</strong>.
          Prompt teknis di-generate otomatis — tidak perlu edit manual.
        </p>
      ) : null}

      <label className="block space-y-1.5 text-sm">
        <span className="text-white/65">Warna preview (registrasi)</span>
        <input
          type="color"
          className="h-10 w-full cursor-pointer rounded-xl border border-white/15 bg-black/40"
          value={form.previewColor ?? "#888888"}
          onChange={(e) => onChange({ ...form, previewColor: e.target.value })}
        />
      </label>

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
        onClick={onToggleAdvanced}
      >
        Advanced prompt (fallback direct)
        <ChevronDown className={cn("size-4 transition", showAdvanced && "rotate-180")} />
      </button>

      {showAdvanced ? (
        <div className={cn(galleryPanelClass, "space-y-3 border-white/10 bg-black/20 p-3")}>
          <label className="block space-y-1.5 text-sm">
            <span className="text-white/65">Transform prompt</span>
            <textarea
              className={cn(fieldClass, "min-h-[160px] resize-y font-mono text-[13px]")}
              value={form.transformPrompt}
              onChange={(e) =>
                onChange({ ...form, transformPrompt: e.target.value, promptMode: "advanced" })
              }
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-white/65">Negative prompt</span>
            <textarea
              className={cn(fieldClass, "min-h-[96px] resize-y font-mono text-[13px]")}
              value={form.negativePrompt}
              onChange={(e) =>
                onChange({ ...form, negativePrompt: e.target.value, promptMode: "advanced" })
              }
            />
          </label>
        </div>
      ) : null}

      <label className="block space-y-1.5 text-sm">
        <span className="text-white/65">Catatan (opsional)</span>
        <textarea
          className={cn(fieldClass, "min-h-[72px] resize-y")}
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          placeholder="QA batch, feedback operator, dll."
        />
      </label>
    </div>
  );
}
