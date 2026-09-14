import type { ProcessingStatus } from "@/lib/imageTypes";

type ProcessingLabelKind = "theme" | "passport" | "default";

export function getProcessingStatusLabel(
  status: ProcessingStatus | undefined,
  kind: ProcessingLabelKind = "default"
): string | null {
  if (status === "pending" || status === "processing") {
    if (kind === "theme") return "Menyusun latar tema…";
    if (kind === "passport") return "Menyiapkan pas foto…";
    return "Memproses foto…";
  }
  if (status === "failed") {
    if (kind === "theme") return "Latar tema gagal · foto asli tetap ada";
    return "Gagal memproses";
  }
  return null;
}
