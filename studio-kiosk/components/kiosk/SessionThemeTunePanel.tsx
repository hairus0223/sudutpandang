"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyThemePrintPreset,
  fetchThemePrintTune,
  saveThemePrintTune,
  type ThemePrintTune,
  type ThemePrintTuneField,
  type ThemePrintPreset,
} from "@/services/themePrintTune.service";

type SessionThemeTunePanelProps = {
  user: string;
  imageId?: string | null;
  themeId?: string | null;
  themeLabel?: string | null;
  applying?: boolean;
};

function formatField(field: ThemePrintTuneField, value: number | boolean) {
  if (field.kind === "toggle") return value ? "On" : "Off";
  const n = Number(value);
  if (field.key === "focalLengthMm" || field.key === "warmth") return n.toFixed(0);
  if (field.key === "aperture") return `f/${n.toFixed(1)}`;
  if (
    field.key === "alphaFeather" ||
    field.key === "hairFeather" ||
    field.key === "colorMatch" ||
    field.key === "backdropDistanceM"
  ) {
    return n.toFixed(1);
  }
  return n.toFixed(2);
}

export function SessionThemeTunePanel({
  user,
  imageId,
  themeId,
  themeLabel,
}: SessionThemeTunePanelProps) {
  const [open, setOpen] = React.useState(true);
  const [tune, setTune] = React.useState<ThemePrintTune | null>(null);
  const [fields, setFields] = React.useState<ThemePrintTuneField[]>([]);
  const [presets, setPresets] = React.useState<ThemePrintPreset[]>([]);
  const [status, setStatus] = React.useState<"idle" | "saving" | "live">("idle");
  const debounceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    void fetchThemePrintTune(themeId)
      .then((data) => {
        setTune(data.tune);
        setFields(data.fields);
        setPresets(data.presets);
      })
      .catch(() => {});
  }, [themeId]);

  const pushLive = React.useCallback(
    (next: ThemePrintTune) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      setStatus("saving");
      debounceRef.current = window.setTimeout(() => {
        void saveThemePrintTune(next, {
          user,
          imageId: imageId || undefined,
          themeId,
        })
          .then((data) => {
            setTune(data.tune);
            setStatus(data.reprocess ? "live" : "idle");
          })
          .catch(() => setStatus("idle"));
      }, 280);
    },
    [user, imageId, themeId]
  );

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  if (!tune) return null;

  const groups: Array<{ name: string; items: ThemePrintTuneField[] }> = [];
  for (const field of fields) {
    const name = field.group || "Lainnya";
    const last = groups[groups.length - 1];
    if (!last || last.name !== name) {
      groups.push({ name, items: [field] });
    } else {
      last.items.push(field);
    }
  }

  return (
    <div className="pointer-events-none absolute right-3 top-12 z-20 flex max-w-[min(100%,22.5rem)] flex-col items-end gap-2 sm:right-4 sm:top-14">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[#E8C872]/35 bg-black/70 px-3 py-1.5 text-[11px] font-medium text-[#E8C872] backdrop-blur-sm"
      >
        <SlidersHorizontal className="size-3.5" />
        {open ? "Tutup tuning" : "Tuning foto"}
      </button>

      {open ? (
        <div className="pointer-events-auto flex w-[min(100vw-1.5rem,22rem)] max-h-[min(72vh,38rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/86 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2 border-b border-white/8 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-white">
                {themeLabel ? `Kamera · ${themeLabel}` : "Tuning kamera"}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/45">
                Disimpan khusus tema ini. Geser = foto di-update.
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-white/40 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Tutup"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
            <div className="mb-3 flex flex-wrap gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.hint}
                  className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/75 hover:border-[#E8C872]/40 hover:text-[#E8C872]"
                  onClick={() => {
                    setTune(preset.values);
                    void applyThemePrintPreset(preset.id, {
                      user,
                      imageId: imageId || undefined,
                      themeId,
                    }).then((data) => {
                      setTune(data.tune);
                      setStatus(data.reprocess ? "live" : "idle");
                    });
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.name}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#E8C872]/80">
                    {group.name}
                  </p>
                  <div className="space-y-3">
                    {group.items.map((field) => {
                      const value = tune[field.key];
                      if (field.kind === "toggle") {
                        return (
                          <label
                            key={field.key}
                            className="flex items-start justify-between gap-3"
                          >
                            <span>
                              <span className="block text-[11px] text-white/80">
                                {field.label}
                              </span>
                              <span className="mt-0.5 block text-[9px] leading-snug text-white/38">
                                {field.hint}
                              </span>
                            </span>
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 accent-[#E8C872]"
                              checked={Boolean(value)}
                              onChange={(e) => {
                                const next = {
                                  ...tune,
                                  [field.key]: e.target.checked,
                                };
                                setTune(next);
                                pushLive(next);
                              }}
                            />
                          </label>
                        );
                      }

                      return (
                        <div key={field.key}>
                          <div className="mb-0.5 flex justify-between text-[11px] text-white/75">
                            <span>{field.label}</span>
                            <span className="font-mono text-[#E8C872]">
                              {formatField(field, value)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={Number(value ?? 0)}
                            onChange={(e) => {
                              const next = {
                                ...tune,
                                [field.key]: Number(e.target.value),
                              };
                              setTune(next);
                              pushLive(next);
                            }}
                            className="w-full accent-[#E8C872]"
                          />
                          <p className="mt-0.5 text-[9px] leading-snug text-white/38">
                            {field.hint}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p
            className={cn(
              "border-t border-white/8 px-3 py-2 text-[10px]",
              status === "saving"
                ? "text-amber-300"
                : status === "live"
                  ? "text-emerald-300"
                  : "text-white/35"
            )}
          >
            {status === "saving"
              ? "Menerapkan ke foto…"
              : status === "live"
                ? "Foto di-update"
                : user
                  ? "Ambil foto dulu, lalu geser slider."
                  : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
