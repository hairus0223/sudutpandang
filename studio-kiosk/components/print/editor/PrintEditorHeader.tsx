"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { countRecipeSlots } from "@/lib/sheetRecipe";
import { Button } from "@/components/ui/button";
import { usePrintSubmit } from "@/hooks/usePrintSubmit";
import type { ImageData } from "@/stores/useGalleryStore";
import { PrintStatusBadge } from "./PrintStatusBadge";

export function PrintEditorHeader({ images }: { images: ImageData[] }) {
  const router = useRouter();
  const {
    printing,
    sheetCanPrint,
    handlePrint,
    printMode,
    sheetRecipe,
    resolvedPaper,
  } = usePrintSubmit(images);

  const slotCount =
    printMode === "sheet" ? countRecipeSlots(sheetRecipe) : images.length;

  const title = printMode === "sheet" ? "Cetak Lembar" : "Cetak Klasik";
  const subtitle =
    printMode === "sheet"
      ? `${sheetRecipe.paperId} · ${slotCount} slot · margin ${resolvedPaper.marginMm.top}mm`
      : `${images.length} foto dipilih`;

  const canPrint = printMode === "sheet" ? sheetCanPrint : true;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-neutral-950/95 px-3 backdrop-blur sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="shrink-0 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Kembali</span>
      </Button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">
            {title}
          </h1>
          {printMode === "sheet" ? (
            <PrintStatusBadge ready={sheetCanPrint} />
          ) : null}
        </div>
        <p className="truncate text-[11px] text-white/45">{subtitle}</p>
      </div>

      <Button
        type="button"
        onClick={handlePrint}
        disabled={printing || !canPrint}
        title={
          !canPrint ? "Layout tidak muat — perbaiki di panel Layout" : undefined
        }
        className="shrink-0 bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
      >
        <Printer
          className={`h-4 w-4 ${printing ? "animate-pulse" : ""}`}
        />
        <span className="hidden sm:inline">
          {printing
            ? "Mencetak..."
            : printMode === "sheet"
              ? "Cetak"
              : "Print"}
        </span>
      </Button>
    </header>
  );
}
