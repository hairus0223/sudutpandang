"use client";

/**
 * @deprecated Use PrintEditorLayout + PrintEditorHeader instead.
 * Kept for backward compatibility if imported elsewhere.
 */
import type { ImageData } from "@/stores/useGalleryStore";
import { PrintEditorHeader } from "./editor/PrintEditorHeader";

export function PrintToolbar({ images }: { images: ImageData[] }) {
  return <PrintEditorHeader images={images} />;
}
