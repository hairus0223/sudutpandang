import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";

export function resolveGalleryPreviewUrl(image: GalleryImageData): string {
  return image.variants?.original ?? image.url;
}

export function resolveImageUrl(image: GalleryImageData): string {
  return image.url;
}

export function resolvePrintUrl(
  image: GalleryImageData,
  variant: PrintVariant = "original",
  aiThemeId?: string | null
): string {
  if (variant === "ai" && aiThemeId && image.variants?.ai?.[aiThemeId]) {
    return image.variants.ai[aiThemeId];
  }
  return image.variants?.original ?? image.url;
}

export function hasAiPrintVariant(
  image: GalleryImageData,
  aiThemeId?: string | null
): boolean {
  if (!aiThemeId) return false;
  return Boolean(image.variants?.ai?.[aiThemeId]);
}

export function getPrintVariantLabel(variant: PrintVariant): string {
  return variant === "ai" ? "AI" : "Asli";
}
