import type { GalleryImageData } from "@/lib/imageTypes";
import { resolveGalleryPreviewUrl } from "@/lib/resolveImageUrl";

export function getAiResultUrl(
  image: GalleryImageData,
  themeId: string | null | undefined
): string | null {
  if (!themeId) return null;
  return image.variants?.ai?.[themeId] ?? null;
}

export function getAiSelectionStatus(image: GalleryImageData): string | null {
  return image.aiSelection?.status ?? null;
}

const AI_STATUS_LABELS: Record<string, string> = {
  ready: "Sudah di-generate",
  pending: "Antrian AI",
  queued: "Antrian AI",
  processing: "Sedang di-generate",
  failed: "Generate gagal",
};

export function getAiSelectionStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return AI_STATUS_LABELS[status] ?? null;
}

export function canGenerateAiSelection(status: string | null | undefined): boolean {
  return !status || !["ready", "pending", "queued", "processing"].includes(status);
}

export function countReadyAiResults(
  images: GalleryImageData[],
  themeId: string | null | undefined
): number {
  if (!themeId) return 0;
  return images.filter((img) => getAiSelectionStatus(img) === "ready").length;
}

const ACTIVE_AI_SLOT_STATUSES = new Set([
  "ready",
  "pending",
  "queued",
  "processing",
]);

/** Count images with an AI job reserved or finished (uses quota). */
export function countUsedAiSlots(images: GalleryImageData[]): number {
  return images.filter((img) => {
    const status = getAiSelectionStatus(img);
    return status ? ACTIVE_AI_SLOT_STATUSES.has(status) : false;
  }).length;
}

export function getImagesWithAiResults(
  images: GalleryImageData[],
  themeId: string | null | undefined
): GalleryImageData[] {
  return images.filter((img) => Boolean(getAiResultUrl(img, themeId)));
}

export function getOriginalPreviewUrl(image: GalleryImageData): string {
  return resolveGalleryPreviewUrl(image);
}
