import type { AiTheme } from "@/lib/imageTypes";

export const AI_IDENTITY_COPY =
  "Orang, wajah, dan pose tetap sama. Pakaian dan latar mengikuti tema.";

export function isAiThemeSelectable(theme: AiTheme): boolean {
  if (theme.selectable === false) return false;
  if (theme.selectable === true) return Boolean(theme.previewUrl);
  return Boolean(theme.previewUrl);
}

export function getAiThemeStyleLabel(theme: Pick<AiTheme, "pipelineMode" | "type">): string {
  if (theme.pipelineMode === "composite-only") return "Latar saja";
  if (theme.pipelineMode === "composite-costume") return "Latar + kostum";
  if (theme.type === "scene") return "Latar saja";
  return "Latar + kostum";
}

export function mapAiClientError(code: string | null | undefined): string {
  const value = String(code ?? "").trim();

  if (value === "quota_exhausted") {
    return "Kuota AI habis.";
  }
  if (value === "theme_required") {
    return "Tema sesi belum di-set. Daftar ulang di layar sesi.";
  }
  if (value === "theme_locked") {
    return "Tema sudah terkunci. Tidak bisa diganti di galeri.";
  }
  if (value === "theme_not_ready") {
    return "Tema belum siap produksi. Pilih tema lain.";
  }
  if (
    value === "composite_pipeline_unavailable" ||
    value === "direct_pipeline_disabled" ||
    value === "face_refine_unavailable" ||
    value === "ai_disabled" ||
    value === "openai_not_configured"
  ) {
    return "Layanan edit AI belum siap.";
  }
  if (value === "identity_mismatch") {
    return "Hasil tidak menjaga wajah asli. Tidak disimpan. Coba foto lain.";
  }
  if (value === "segmentation_failed" || value === "person_segmentation_disabled") {
    return "Tidak bisa memisahkan orang dari foto. Ambil ulang dengan latar lebih polos.";
  }
  if (value === "openai_timeout" || value.startsWith("timeout:")) {
    return "Edit kostum terlalu lama. Coba lagi.";
  }
  if (value === "job_interrupted") {
    return "Job terputus karena server restart. Coba edit lagi.";
  }
  if (value === "ai_generate_failed") {
    return "Edit foto gagal. Coba lagi.";
  }

  return "Edit foto gagal. Coba lagi.";
}
