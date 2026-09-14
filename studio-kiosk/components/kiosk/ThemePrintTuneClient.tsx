"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  applyThemePrintPreset,
  fetchThemePrintTune,
  saveThemePrintTune,
  type ThemePrintTune,
  type ThemePrintTuneField,
  type ThemePrintPreset,
  type ThemePrintTuneTheme,
} from "@/services/themePrintTune.service";

function formatValue(field: ThemePrintTuneField, value: number | boolean) {
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

export function ThemePrintTuneClient() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [tune, setTune] = React.useState<ThemePrintTune | null>(null);
  const [fields, setFields] = React.useState<ThemePrintTuneField[]>([]);
  const [presets, setPresets] = React.useState<ThemePrintPreset[]>([]);
  const [themes, setThemes] = React.useState<ThemePrintTuneTheme[]>([]);
  const [themeId, setThemeId] = React.useState<string>("");
  const [persistPath, setPersistPath] = React.useState("");

  const load = React.useCallback(
    async (id?: string) => {
      const data = await fetchThemePrintTune(id || undefined);
      setTune(data.tune);
      setFields(data.fields);
      setPresets(data.presets);
      setThemes(data.themes ?? []);
      setPersistPath(data.persistPath);
      if (data.themeId) setThemeId(data.themeId);
    },
    []
  );

  React.useEffect(() => {
    void load()
      .catch(() => toast("Tidak bisa memuat tuning. Cek API :4000.", "error"))
      .finally(() => setLoading(false));
  }, [load, toast]);

  const persist = async (next: ThemePrintTune) => {
    setSaving(true);
    try {
      const data = await saveThemePrintTune(next, { themeId: themeId || undefined });
      setTune(data.tune);
      setPersistPath(data.persistPath);
      toast(
        themeId
          ? "Tuning tema ini tersimpan."
          : "Tuning global tersimpan. Pilih tema untuk simpan per-tema.",
        "success"
      );
    } catch {
      toast("Gagal menyimpan tuning.", "error");
    } finally {
      setSaving(false);
    }
  };

  const onPreset = async (presetId: string) => {
    setSaving(true);
    try {
      const data = await applyThemePrintPreset(presetId, {
        themeId: themeId || undefined,
      });
      setTune(data.tune);
      toast("Preset tersimpan untuk tema ini.", "success");
    } catch {
      toast("Gagal memakai preset.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-black px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Beranda
        </Link>

        <h1 className="mt-5 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SlidersHorizontal className="size-6 text-[#E8C872]" />
          Tuning Foto Tema
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
          Latar adalah foto tema asli (50mm f/4.5). Pilih tema, atur lensa,
          lalu simpan — setting terpisah per tema.
        </p>

        <label className="mt-5 block text-xs text-white/55">
          Tema
          <select
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            value={themeId}
            onChange={(e) => {
              const id = e.target.value;
              setThemeId(id);
              setLoading(true);
              void load(id)
                .catch(() => toast("Gagal memuat tema.", "error"))
                .finally(() => setLoading(false));
            }}
          >
            <option value="">Default semua tema</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={saving || loading}
              onClick={() => void onPreset(preset.id)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:border-[#E8C872]/50 hover:text-[#E8C872] disabled:opacity-50"
              title={preset.hint}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          50mm f/4.5: tema jelas. 85mm f/2.2: portrait. 35mm f/5.6: lebih banyak
          set. File: {persistPath || "config/theme-print-tune.json"}
        </p>

        {loading || !tune ? (
          <p className="mt-10 text-sm text-white/45">Memuat…</p>
        ) : (
          <div className="mt-8 space-y-8">
            {(() => {
              const groups: Array<{ name: string; items: ThemePrintTuneField[] }> =
                [];
              for (const field of fields) {
                const name = field.group || "Lainnya";
                const last = groups[groups.length - 1];
                if (!last || last.name !== name) {
                  groups.push({ name, items: [field] });
                } else {
                  last.items.push(field);
                }
              }
              return groups.map((group) => (
                <section key={group.name} className="space-y-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#E8C872]/85">
                    {group.name}
                  </h2>
                  {group.items.map((field) => {
                    const value = tune[field.key];
                    if (field.kind === "toggle") {
                      return (
                        <label
                          key={field.key}
                          className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                        >
                          <span>
                            <span className="block text-sm font-medium">
                              {field.label}
                            </span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-white/45">
                              {field.hint}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            className="mt-1 size-5 accent-[#E8C872]"
                            checked={Boolean(value)}
                            onChange={(e) =>
                              setTune({ ...tune, [field.key]: e.target.checked })
                            }
                          />
                        </label>
                      );
                    }

                    return (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <label className="text-sm font-medium" htmlFor={field.key}>
                            {field.label}
                          </label>
                          <span className="font-mono text-sm text-[#E8C872]">
                            {formatValue(field, value)}
                          </span>
                        </div>
                        <input
                          id={field.key}
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={Number(value ?? 0)}
                          onChange={(e) =>
                            setTune({
                              ...tune,
                              [field.key]: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[#E8C872]"
                        />
                        <p className="text-[11px] leading-relaxed text-white/40">
                          {field.hint}
                        </p>
                      </div>
                    );
                  })}
                </section>
              ));
            })()}

            <Button
              type="button"
              disabled={saving}
              className="h-12 w-full bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
              onClick={() => void persist(tune)}
            >
              {saving ? "Menyimpan…" : "Simpan tuning"}
            </Button>
            <p className="text-center text-[11px] text-white/35">
              Di sesi Foto Tema, slider langsung meng-update foto terakhir
              (tanpa capture ulang). Preset di sini jadi default studio.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
