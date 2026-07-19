"use client";

import { useMemo } from "react";
import { useGalleryStore, PhotoFilter, type ImageData } from "@/stores/useGalleryStore";
import { PanelSection } from "./printEditorUi";
import { cn } from "@/lib/utils";

const FILTERS: { id: PhotoFilter; label: string }[] = [
  { id: "none", label: "Natural" },
  { id: "soft", label: "Soft" },
  { id: "bw", label: "B&W" },
  { id: "vintage", label: "Vintage" },
  { id: "cinematic", label: "Cinematic" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "drama", label: "Drama" },
];

export function PrintFilterPanel({ images }: { images: ImageData[] }) {
  const { photoTransforms, setPhotoTransform, packageType } = useGalleryStore();

  const activeFilter = useMemo(() => {
    if (!images.length) return "none" as PhotoFilter;
    return photoTransforms[images[0].filename]?.filter ?? "none";
  }, [images, photoTransforms]);

  const activeIntensity = useMemo(() => {
    if (!images.length) return 1;
    return photoTransforms[images[0].filename]?.intensity ?? 1;
  }, [images, photoTransforms]);

  const bakedCount = useMemo(
    () => images.filter((img) => img.bakedLookId && img.variants?.themed).length,
    [images]
  );

  const applyFilter = (filter: PhotoFilter) => {
    images.forEach((img) =>
      setPhotoTransform(img.filename, { filter, intensity: 1 })
    );
  };

  const changeIntensity = (value: number) => {
    images.forEach((img) =>
      setPhotoTransform(img.filename, { intensity: value })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {packageType === "ai-photo" && (
        <div className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 py-2.5 text-xs leading-relaxed text-violet-100">
          <p className="font-semibold tracking-wide text-violet-50">
            Hasil AI Photo
          </p>
          <p className="mt-1 text-violet-100/80">
            Look sudah menyatu di file bertema
            {bakedCount > 0 ? ` (${bakedCount} foto)` : ""}. Filter ekstra opsional —
            jangan terlalu keras agar tetap natural.
          </p>
        </div>
      )}

      <PanelSection
        title="Filter foto"
        description={
          packageType === "ai-photo"
            ? "Sentuhan akhir sebelum cetak — keep it subtle"
            : "Berlaku untuk semua foto di halaman cetak"
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => applyFilter(f.id)}
              className={cn(
                "min-h-[44px] rounded-lg border px-2 py-2 text-xs font-medium transition",
                activeFilter === f.id
                  ? "border-green-500/50 bg-green-600/25 text-white"
                  : "border-white/10 bg-white/5 text-white/75 hover:border-white/20 hover:bg-white/10"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </PanelSection>

      {activeFilter !== "none" ? (
        <PanelSection title="Intensitas">
          <div className="flex flex-col gap-2 px-1">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(activeIntensity * 100)}
              onChange={(e) =>
                changeIntensity(Number(e.target.value) / 100)
              }
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-[10px] text-white/45">
              <span>Halus</span>
              <span>{Math.round(activeIntensity * 100)}%</span>
              <span>Kuat</span>
            </div>
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}
