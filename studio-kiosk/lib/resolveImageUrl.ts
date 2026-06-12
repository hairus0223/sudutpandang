import type { GalleryImageData, PackageType } from "@/lib/imageTypes";

export type ImageUrlContext = "gallery" | "kiosk" | "print";

export type GalleryPreviewVariant = "auto" | "original" | "subject" | "themed";

export const GALLERY_PREVIEW_VARIANTS: {
  id: GalleryPreviewVariant;
  label: string;
}[] = [
  { id: "auto", label: "Auto" },
  { id: "original", label: "Original" },
  { id: "subject", label: "Tanpa BG" },
  { id: "themed", label: "Bertema" },
];

export function hasSubjectVariant(image: GalleryImageData): boolean {
  return Boolean(image.variants?.subject);
}

export function hasThemedVariant(image: GalleryImageData): boolean {
  return Boolean(image.variants?.themed);
}

/**
 * Resolve gallery preview URL with explicit variant override.
 */
export function resolveGalleryPreviewUrl(
  image: GalleryImageData,
  packageType: PackageType,
  variant: GalleryPreviewVariant = "auto"
): string {
  if (variant === "auto") {
    return resolveImageUrl(image, packageType, "gallery");
  }

  if (variant === "original") {
    return image.variants?.original ?? image.url;
  }

  if (variant === "subject" && image.variants?.subject) {
    return image.variants.subject;
  }

  if (variant === "themed" && image.variants?.themed) {
    return image.variants.themed;
  }

  return image.url;
}

/**
 * Resolve which image URL to load for a given package and UI context.
 */
export function resolveImageUrl(
  image: GalleryImageData,
  packageType: PackageType,
  context: ImageUrlContext = "gallery"
): string {
  if (image.processingStatus === "ready") {
    if (context !== "gallery") {
      if (packageType === "pas-photo" && image.variants?.passport) {
        return image.variants.passport;
      }

      if (packageType === "ai-photo" && image.variants?.themed) {
        return image.variants.themed;
      }

      if (
        (packageType === "ai-photo" || packageType === "pas-photo") &&
        image.variants?.subject
      ) {
        return image.variants.subject;
      }
    }

    if (context === "gallery" && packageType === "ai-photo" && image.variants?.themed) {
      return image.variants.themed;
    }
  }

  return image.url;
}
