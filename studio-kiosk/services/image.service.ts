import { API_BASE_URL } from "@/lib/env";
import type {
  FetchImagesResponse,
  ImageStatusResponse,
} from "@/lib/imageTypes";

export async function fetchImages(userId: string): Promise<FetchImagesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/images/${userId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Images not found");
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

export async function processImage(
  userId: string,
  imageId: string,
  operation = "remove-bg",
  options?: { themeId?: string; color?: string }
): Promise<{ success: boolean; imageId: string; status: string }> {
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
    throw new Error("Image process failed");
  }

  return res.json();
}

export async function uploadImage(
  userId: string,
  file: File
): Promise<{
  success: boolean;
  imageId: string;
  originalUrl: string;
  status: string;
}> {
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
    throw new Error("Image upload failed");
  }

  return res.json();
}
