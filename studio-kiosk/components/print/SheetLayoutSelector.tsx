"use client";

/**
 * @deprecated Layout controls moved to PrintLayoutPanel / PrintClassicPanel.
 */
import { useGalleryStore, type ImageData } from "@/stores/useGalleryStore";
import { PrintModeToggle } from "./editor/PrintModeToggle";

export function SheetLayoutSelector({ images: _images }: { images: ImageData[] }) {
  const { printMode } = useGalleryStore();
  if (printMode !== "sheet") return <PrintModeToggle />;
  return <PrintModeToggle />;
}
