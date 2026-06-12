import type {
  GalleryImageData,
  PackageType,
  ProcessingPhase,
  ProcessingStatus,
} from "@/lib/imageTypes";

/**
 * Infer processing phase for legacy meta without processingPhase field.
 */
export function inferProcessingPhase(
  image: Pick<GalleryImageData, "processingPhase" | "variants">,
  packageType: PackageType
): ProcessingPhase | null {
  if (image.processingPhase) return image.processingPhase;

  if (image.variants?.subject) {
    if (packageType === "ai-photo" && !image.variants?.themed) {
      return "apply-theme";
    }
    if (packageType === "pas-photo" && !image.variants?.passport) {
      return "apply-passport-bg";
    }
  }

  return "remove-bg";
}

export function isImageProcessing(status?: ProcessingStatus): boolean {
  return status === "pending" || status === "processing";
}

export function getProcessingStatusLabel(
  status?: ProcessingStatus,
  options?: {
    packageType?: PackageType;
    processingPhase?: ProcessingPhase | null;
    variants?: GalleryImageData["variants"];
    short?: boolean;
  }
): string | null {
  if (!isImageProcessing(status)) {
    switch (status) {
      case "ready":
        return "Siap";
      case "failed":
        return "Gagal";
      default:
        return null;
    }
  }

  const packageType = options?.packageType ?? "self-photo";
  const phase =
    options?.processingPhase ??
    (options?.variants
      ? inferProcessingPhase(
          {
            processingPhase: options.processingPhase,
            variants: options.variants,
          },
          packageType
        )
      : "remove-bg");

  if (phase === "apply-theme") {
    return options?.short ? "Tema AI…" : "Menerapkan tema AI…";
  }

  if (phase === "apply-passport-bg") {
    return options?.short ? "Pas foto…" : "Membuat pas foto…";
  }

  if (packageType === "ai-photo") {
    return options?.short ? "AI…" : "Menghapus background…";
  }

  if (packageType === "pas-photo") {
    return options?.short ? "BG…" : "Menghapus background…";
  }

  return options?.short ? "Proses…" : "Memproses…";
}

export function countProcessingImages(
  images: GalleryImageData[]
): number {
  return images.filter((img) => isImageProcessing(img.processingStatus)).length;
}
