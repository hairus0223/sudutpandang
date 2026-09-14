import type { GalleryImageData, PrintVariant } from "@/lib/imageTypes";

export function resolveGalleryPreviewUrl(image: GalleryImageData): string {
  return (
    image.variants?.theme ??
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
  if (variant === "theme" && image.variants?.theme) {
    return image.variants.theme;
  }
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

export function hasThemePrintVariant(image: GalleryImageData): boolean {
  return Boolean(image.variants?.theme);
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

/** Prefer the flattened 300 DPI JPEG print shops expect, PNG otherwise. */
export function getPassportDownload(
  image: GalleryImageData,
  sizeId: string
): { url: string; filename: string } | null {
  const jpg = image.variants?.passportPrintSizes?.[sizeId];
  if (jpg) return { url: jpg, filename: `pasfoto-${sizeId}-300dpi.jpg` };

  const png = image.variants?.passportSizes?.[sizeId];
  if (png) return { url: png, filename: `pasfoto-${sizeId}.png` };

  return null;
}

export function getPrintVariantLabel(variant: PrintVariant): string {
  if (variant === "ai") return "AI";
  if (variant === "theme") return "Tema";
  if (variant === "passport") return "Pas foto";
  return "Asli";
}
