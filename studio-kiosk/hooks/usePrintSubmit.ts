"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { exportCanvasPrint, exportSheetPrint } from "@/utils/exportCanvas";
import { API_BASE_URL } from "@/lib/env";
import { useResolvedSheetPaper } from "@/hooks/useResolvedSheetPaper";
import { packSheetRecipe, validateSheetRecipe } from "@/utils/sheetLayoutEngine";
import type { PrintTemplate } from "@/lib/printTemplates";
import type { ImageData } from "@/stores/useGalleryStore";

export function usePrintSubmit(images: ImageData[]) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);

  const {
    resetSelection,
    printTemplate,
    printMode,
    sheetRecipe,
    sheetCopies,
    sheetAlign,
    sheetBindingMode,
    sheetSizeAssignments,
    sheetSlotAssignments,
    sheetSlotTransforms,
    sheetPaperMargins,
    photoTransforms,
    faceBoxes,
    persistSheetTransforms,
  } = useGalleryStore();

  const resolvedPaper = useResolvedSheetPaper();

  const sheetValidation = useMemo(
    () => validateSheetRecipe(sheetRecipe, resolvedPaper),
    [sheetRecipe, resolvedPaper]
  );

  const sheetCanPrint = useMemo(() => {
    if (printMode !== "sheet") return true;
    return (
      sheetValidation.rows.every((row) => row.fits) &&
      sheetValidation.fitsVertically
    );
  }, [printMode, sheetValidation]);

  const handlePrint = async () => {
    if (!images.length || printing) return;

    try {
      setPrinting(true);

      if (printMode === "sheet") {
        if (!sheetCanPrint) {
          alert(
            "Layout tidak muat di kertas dengan margin ini. Perkecil margin, baris, atau jumlah foto."
          );
          return;
        }

        const geometry = packSheetRecipe(
          sheetRecipe,
          resolvedPaper,
          sheetAlign
        );

        persistSheetTransforms();

        const pngs = await exportSheetPrint({
          images,
          recipe: sheetRecipe,
          transforms: photoTransforms,
          sheetSlotTransforms,
          faceBoxes,
          bindingMode: sheetBindingMode,
          sizeAssignments: sheetSizeAssignments,
          slotAssignments: sheetSlotAssignments,
          includeCutLines: false,
          copies: sheetCopies,
          align: sheetAlign,
          paperMargins: sheetPaperMargins,
        });

        await fetch(`${API_BASE_URL}/api/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: pngs,
            layoutType: "sheet",
            paperId: sheetRecipe.paperId,
            recipeId: sheetRecipe.id,
            recipeLabel: sheetRecipe.label,
            slotCount: sheetValidation.slotCount,
            pageWidthPx: geometry.paperWidthPx,
            pageHeightPx: geometry.paperHeightPx,
          }),
        });
      } else {
        const pngs = await exportCanvasPrint(
          images,
          printTemplate.width,
          printTemplate.height,
          photoTransforms,
          faceBoxes,
          printTemplate.id as PrintTemplate["id"]
        );

        await fetch(`${API_BASE_URL}/api/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: pngs, templateId: printTemplate.id }),
        });
      }

      resetSelection();
      setTimeout(() => router.back(), 0);
    } catch (err) {
      console.error("Print failed:", err);
      alert("Gagal mencetak. Silakan coba lagi.");
    } finally {
      setPrinting(false);
    }
  };

  return {
    printing,
    sheetCanPrint,
    sheetValidation,
    handlePrint,
    printMode,
    sheetRecipe,
    resolvedPaper,
  };
}
