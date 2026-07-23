import type { ProcessingStatus } from "@/lib/imageTypes";

export function getProcessingStatusLabel(
  status: ProcessingStatus | undefined
): string | null {
  if (status === "pending" || status === "processing") {
    return "Memproses foto…";
  }
  if (status === "failed") {
    return "Gagal memproses";
  }
  return null;
}
