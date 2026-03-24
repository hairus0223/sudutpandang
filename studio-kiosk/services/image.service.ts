import { API_BASE_URL } from "@/lib/env";

export async function fetchImages(userId: string) {
  const res = await fetch(`${API_BASE_URL}/api/images/${userId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Images not found");
  }

  return res.json();
}
