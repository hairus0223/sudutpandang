"use client";

import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import { PRINT_TEMPLATES } from "@/lib/printTemplates";
import { SheetRecipeComposer } from "./SheetRecipeComposer";
import { cn } from "@/lib/utils";

export function SheetLayoutSelector({ images }: { images: ImageData[] }) {
  const { printMode, setPrintMode, printTemplate, setPrintTemplate } =
    useGalleryStore();

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setPrintMode("classic")}
          className={cn(
            "rounded px-3 py-1.5 text-xs sm:text-sm transition",
            printMode === "classic"
              ? "bg-green-600 text-white"
              : "bg-white/10 hover:bg-white/20"
          )}
        >
          Klasik 4R
        </button>
        <button
          type="button"
          onClick={() => setPrintMode("sheet")}
          className={cn(
            "rounded px-3 py-1.5 text-xs sm:text-sm transition",
            printMode === "sheet"
              ? "bg-green-600 text-white"
              : "bg-white/10 hover:bg-white/20"
          )}
        >
          Cetak Lembar
        </button>
      </div>

      {printMode === "classic" ? (
        <div className="flex flex-wrap justify-center gap-2">
          {PRINT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setPrintTemplate(tpl)}
              className={cn(
                "rounded px-3 py-1.5 text-xs sm:text-sm transition",
                printTemplate.id === tpl.id
                  ? "bg-white/20 text-white"
                  : "bg-white/10 hover:bg-white/20"
              )}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      ) : (
        <SheetRecipeComposer images={images} />
      )}
    </div>
  );
}
