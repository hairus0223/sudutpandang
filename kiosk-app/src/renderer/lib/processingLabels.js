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
  return "Memproses foto… harap tunggu";
}
