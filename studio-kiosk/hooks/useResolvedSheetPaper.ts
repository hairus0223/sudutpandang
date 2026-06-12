import { useMemo } from "react";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { resolvePaperForLayout } from "@/lib/resolvePaper";

export function useResolvedSheetPaper() {
  const paperId = useGalleryStore((s) => s.sheetRecipe.paperId);
  const margins = useGalleryStore((s) => s.sheetPaperMargins);

  return useMemo(
    () => resolvePaperForLayout(paperId, margins),
    [paperId, margins]
  );
}
