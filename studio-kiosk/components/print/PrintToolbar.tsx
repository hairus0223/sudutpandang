"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useGalleryStore, PhotoFilter } from "@/stores/useGalleryStore";
import { TemplateSelector } from "./TemplateSelector";
import { exportCanvasPrint, ImageData } from "@/utils/exportCanvas";
import { API_BASE_URL } from "@/lib/env";

const FILTERS: { id: PhotoFilter; label: string }[] = [
  { id: "none", label: "Normal" },
  { id: "soft", label: "Soft" },
  { id: "bw", label: "B&W" },
  { id: "vintage", label: "Vintage" },
  { id: "cinematic", label: "Cinematic" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "drama", label: "Drama" },
];


export function PrintToolbar({ images }: { images: ImageData[] }) {
  const router = useRouter();

  const [printing, setPrinting] = useState(false);

  const {
    resetSelection,
    printTemplate,
    photoTransforms,
    setPhotoTransform,
    faceBoxes,
  } = useGalleryStore();

  /* =========================
   * ACTIVE STATE (UX)
   * ========================= */
  const activeFilter = useMemo(() => {
    if (!images.length) return "none";
    return photoTransforms[images[0].filename]?.filter ?? "none";
  }, [images, photoTransforms]);

  const activeIntensity = useMemo(() => {
    if (!images.length) return 1;
    return photoTransforms[images[0].filename]?.intensity ?? 1;
  }, [images, photoTransforms]);

  /* =========================
   * ACTIONS
   * ========================= */
  const applyFilter = (filter: PhotoFilter) => {
    images.forEach((img) =>
      setPhotoTransform(img.filename, {
        filter,
        intensity: 1, // reset ke default
      })
    );
  };

  const changeIntensity = (value: number) => {
    images.forEach((img) =>
      setPhotoTransform(img.filename, { intensity: value })
    );
  };

  const handlePrint = async () => {
    if (!images.length || printing) return;

    try {
      setPrinting(true);

      const pngs = await exportCanvasPrint(
        images,
        printTemplate.width,
        printTemplate.height,
        photoTransforms,
        faceBoxes,
        printTemplate.id
      );

      await fetch(`${API_BASE_URL}/api/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: pngs, templateId: printTemplate.id }),
      });

      resetSelection();

      setTimeout(() => {
        router.back();
      }, 0);
    } catch (err) {
      console.error("Print failed:", err);
      alert("Gagal mencetak. Silakan coba lagi.");
    } finally {
      setPrinting(false);
    }
  };


  /* =========================
   * UI
   * ========================= */
  return (
    <div className="min-h-[50px] px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-black text-white">
      {/* LEFT */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm sm:text-base text-white/80 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        Kembali
      </button>

      {/* CENTER */}
      <div className="flex flex-col items-center gap-2 order-last w-full sm:order-none sm:w-auto">
        <TemplateSelector />

        {/* FILTER BUTTONS */}
        <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => applyFilter(f.id)}
                className={`
                  px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition
                  ${isActive
                    ? "bg-green-600 text-white"
                    : "bg-white/10 hover:bg-white/20"}
                `}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* INTENSITY SLIDER */}
        {activeFilter !== "none" && (
          <div className="flex items-center gap-3 text-xs text-white/80">
            <span>Natural</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(activeIntensity * 100)}
              onChange={(e) =>
                changeIntensity(Number(e.target.value) / 100)
              }
              className="w-40 accent-green-500"
            />
            <span>Strong</span>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <button
        onClick={handlePrint}
        disabled={printing}
        className={`
          flex items-center gap-2 px-4 sm:px-6 py-2 rounded text-sm sm:text-base
          transition
          ${printing
            ? "bg-green-600/50 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-500"}
        `}
      >
        <Printer className={`w-4 h-4 sm:w-5 sm:h-5 ${printing ? "animate-pulse" : ""}`} />
        {printing ? "Sedang mencetak..." : "Print"}
      </button>
    </div>
  );
}
