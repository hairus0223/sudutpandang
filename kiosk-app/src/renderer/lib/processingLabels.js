/**
 * @param {import('../services/api').PreviewImage | null | undefined} image
 * @param {boolean} isProcessing
 * @returns {string | null}
 */
export function getKioskProcessingMessage(isProcessing, image) {
  if (!isProcessing) return null;
  if (image?.processingStatus === "failed") {
    return "Proses foto gagal.";
  }
  if (image?.processingPhase === "remove-bg" || image?.processingPhase === "apply-passport-bg") {
    return "Menyiapkan pas foto… harap tunggu";
  }
  return "Memproses foto… harap tunggu";
}
