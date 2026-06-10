import type { GalleryImageData, PackageType } from "@/lib/imageTypes";

export type ImageUrlContext = "gallery" | "kiosk" | "print";

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
