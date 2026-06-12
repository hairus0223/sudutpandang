import { API_BASE_URL } from "@/lib/env";
import type {
  FetchImagesResponse,
  FetchThemesResponse,
  ImageStatusResponse,
  PollImageStatusOptions,
  ProcessImageResponse,
  ProcessingStatus,
  UploadImageResponse,
} from "@/lib/imageTypes";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("poll_aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("poll_aborted"));
      },
      { once: true }
    );
  });
}

async function parseProcessError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: string;
      message?: string;
    };
    if (data.message) {
      return data.message;
    }
    if (data.error === "not_found") {
      return "Foto tidak ditemukan.";
    }
    if (data.error === "unsupported_operation") {
      return "Operasi foto tidak didukung.";
    }
    if (data.error === "rate_limited") {
      return "Terlalu cepat. Tunggu sebentar sebelum memproses lagi.";
    }
    if (data.error === "too_many_jobs") {
      return "Terlalu banyak proses foto berjalan. Tunggu sebentar.";
    }
  } catch {
    // ignore JSON parse errors
  }
  return "Proses foto gagal. Silakan coba lagi.";
}

export async function fetchImages(userId: string): Promise<FetchImagesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/images/${userId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Images not found");
  }

  return res.json();
}

export async function fetchThemes(): Promise<FetchThemesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/themes`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("themes_fetch_failed");
  }

  return res.json();
}

export async function fetchImageStatus(
  userId: string,
  imageId: string
): Promise<ImageStatusResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/images/${encodeURIComponent(userId)}/${encodeURIComponent(imageId)}/status`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Image status not found");
  }

  return res.json();
}

export async function pollImageStatus(
  userId: string,
  imageId: string,
  options: PollImageStatusOptions = {}
): Promise<ImageStatusResponse> {
  const intervalMs = options.intervalMs ?? 2000;
  const maxMs = options.maxMs ?? 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxMs) {
    if (options.signal?.aborted) {
      throw new Error("poll_aborted");
    }

    const status = await fetchImageStatus(userId, imageId);

    if (status.status === "ready" || status.status === "failed") {
      return status;
    }

    await sleep(intervalMs, options.signal);
  }

  throw new Error("poll_timeout");
}

export async function processImage(
  userId: string,
  imageId: string,
  operation = "remove-bg",
  options?: { themeId?: string; color?: string }
): Promise<ProcessImageResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/images/${encodeURIComponent(userId)}/${encodeURIComponent(imageId)}/process`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation,
        themeId: options?.themeId,
        color: options?.color,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(await parseProcessError(res));
  }

  return res.json();
}

export async function processRemoveBackground(
  userId: string,
  imageId: string
): Promise<ProcessImageResponse> {
  return processImage(userId, imageId, "remove-bg");
}

export async function applyTheme(
  userId: string,
  imageId: string,
  themeId: string
): Promise<ProcessImageResponse> {
  return processImage(userId, imageId, "apply-theme", { themeId });
}

export async function uploadImage(
  userId: string,
  file: File
): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE_URL}/api/images/${encodeURIComponent(userId)}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) {
    throw new Error("Upload foto gagal. Periksa ukuran file dan coba lagi.");
  }

  return res.json();
}

export function isTerminalProcessingStatus(
  status: ProcessingStatus | undefined
): status is Extract<ProcessingStatus, "ready" | "failed"> {
  return status === "ready" || status === "failed";
}
