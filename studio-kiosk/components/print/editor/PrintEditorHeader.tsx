"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ImageIcon, Layers, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { countRecipeSlots } from "@/lib/sheetRecipe";
import { Button } from "@/components/ui/button";
import { usePrintSubmit } from "@/hooks/usePrintSubmit";
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import { PrintStatusBadge } from "./PrintStatusBadge";
import { cn } from "@/lib/utils";

function HeaderBadge({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60 ring-1 ring-white/8 sm:text-[11px]",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function PrintEditorHeader({ images }: { images: ImageData[] }) {
  const router = useRouter();
  const printTemplate = useGalleryStore((s) => s.printTemplate);
  const {
    printing,
    sheetCanPrint,
    handlePrint,
    printMode,
    sheetRecipe,
    resolvedPaper,
  } = usePrintSubmit(images);

  const chunkSize = printTemplate.id === "4R_FULL" ? 1 : 2;
  const classicPageCount =
    printMode === "classic"
      ? Math.max(1, Math.ceil(images.length / chunkSize))
      : 0;

  const slotCount =
    printMode === "sheet" ? countRecipeSlots(sheetRecipe) : images.length;

  const title = printMode === "sheet" ? "Cetak Lembar" : "Editor Cetak";
  const canPrint = printMode === "sheet" ? sheetCanPrint : true;

  const templateShort =
    printTemplate.id === "4R_FULL"
      ? "4R Full"
      : printTemplate.id === "4R"
        ? "4R · 2 foto/hal"
        : printTemplate.label;

  return (
    <header className="shrink-0 border-b border-white/10 bg-neutral-950/98 backdrop-blur-md">
      <div className="flex min-h-14 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-9 shrink-0 px-2 text-white/75 hover:bg-white/10 hover:text-white sm:px-3"
          aria-label="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Kembali</span>
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h1 className="truncate text-sm font-semibold text-white sm:text-base">
              {title}
            </h1>
            {printMode === "sheet" ? (
              <PrintStatusBadge ready={sheetCanPrint} />
            ) : classicPageCount > 1 ? (
              <HeaderBadge icon={<Layers className="h-3 w-3" />}>
                {classicPageCount} halaman
              </HeaderBadge>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {printMode === "sheet" ? (
              <>
                <HeaderBadge>{sheetRecipe.paperId}</HeaderBadge>
                <HeaderBadge>{slotCount} slot</HeaderBadge>
                <HeaderBadge className="hidden sm:inline-flex">
                  margin {resolvedPaper.marginMm.top}mm
                </HeaderBadge>
              </>
            ) : (
              <>
                <HeaderBadge>{templateShort}</HeaderBadge>
                <HeaderBadge icon={<ImageIcon className="h-3 w-3" />}>
                  {images.length} foto
                </HeaderBadge>
                {classicPageCount > 1 ? (
                  <span className="hidden text-[10px] text-white/35 sm:inline">
                    Gulir ke bawah untuk semua halaman
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={handlePrint}
          disabled={printing || !canPrint}
          title={
            !canPrint ? "Layout tidak muat — perbaiki di panel Layout" : undefined
          }
          className="h-9 shrink-0 gap-1.5 bg-emerald-600 px-3 text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 sm:px-4"
        >
          <Printer className={cn("h-4 w-4", printing && "animate-pulse")} />
          <span className="text-sm font-medium">
            {printing ? "Mencetak…" : "Cetak"}
          </span>
        </Button>
      </div>
    </header>
  );
}
