/**
 * @param {import('../services/api').PreviewImage | null | undefined} image
 * @param {string} packageType
 * @returns {'remove-bg' | 'apply-theme' | 'apply-passport-bg' | null}
 */
export function inferProcessingPhase(image, packageType) {
  if (!image) return "remove-bg";
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

/**
 * @param {string} packageType
 * @param {boolean} isProcessing
 * @param {import('../services/api').PreviewImage | null | undefined} [image]
 * @param {boolean} [isReviewing]
 * @returns {string | null}
 */
export function getKioskProcessingMessage(
  packageType,
  isProcessing,
  image,
  isReviewing = false
) {
  if (!isProcessing) {
    if (packageType === "ai-photo" && isReviewing) {
      return "Wow — transformasi AI siap!";
    }
    return null;
  }

  const phase = inferProcessingPhase(image, packageType);

  if (phase === "apply-theme") {
    return "Menyatuin lighting & tema AI…";
  }

  if (phase === "apply-passport-bg") {
    return "Membuat pas foto… harap tunggu";
  }

  if (packageType === "ai-photo") {
    return "Memotong background… sebentar lagi magic-nya";
  }

  if (packageType === "pas-photo") {
    return "Menghapus background… harap tunggu";
  }

  return "Memproses foto… harap tunggu";
}
