import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";

export function resolveGalleryPreviewUrl(image: GalleryImageData): string {
  return (
    image.variants?.passport ??
    image.variants?.passportSizes?.["3x4"] ??
    image.variants?.original ??
    image.url
  );
}

export function resolveImageUrl(image: GalleryImageData): string {
  return resolveGalleryPreviewUrl(image);
}

export function resolvePrintUrl(
  image: GalleryImageData,
  variant: PrintVariant = "original",
  aiThemeId?: string | null
): string {
  if (variant === "ai" && aiThemeId && image.variants?.ai?.[aiThemeId]) {
    return image.variants.ai[aiThemeId];
  }
  if (variant === "passport") {
    return (
      image.variants?.subject ??
      image.variants?.passport ??
      image.variants?.original ??
      image.url
    );
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

export function hasPassportPrintVariant(image: GalleryImageData): boolean {
  return Boolean(image.variants?.passport || image.variants?.subject);
}

export function getPassportSizeUrl(
  image: GalleryImageData,
  sizeId: string
): string | null {
  return image.variants?.passportSizes?.[sizeId] ?? null;
}

export function getPrintVariantLabel(variant: PrintVariant): string {
  if (variant === "ai") return "AI";
  if (variant === "passport") return "Pas foto";
  return "Asli";
}
