import { API_BASE_URL } from "@/lib/env";
import type { FetchImagesResponse } from "@/lib/imageTypes";

export async function fetchImages(userId: string): Promise<FetchImagesResponse> {
  const res = await fetch(`${API_BASE_URL}/api/images/${userId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Images not found");
  }

  return res.json();
}
