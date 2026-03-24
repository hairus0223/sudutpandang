"use client";

import logo from "@/assets/dark-logo.png";

let cachedLogo: HTMLImageElement | null = null;

export function loadBrandingLogo(): Promise<HTMLImageElement> {
  if (cachedLogo) {
    return Promise.resolve(cachedLogo);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logo.src;

    img.onload = () => {
      cachedLogo = img;
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error("Failed to load branding logo"));
    };
  });
}
