import { PhotoFilter } from "@/stores/useGalleryStore";

export function getCanvasFilter(
  filter?: PhotoFilter,
  intensity = 1
) {
  const i = Math.max(0, Math.min(intensity, 1));

  switch (filter) {
    case "soft":
      // Soft dreamy: cerah & sedikit kontras
      return `
        brightness(${1 + 0.08 * i})
        contrast(${1 - 0.05 * i})
        saturate(${1 + 0.1 * i})
      `;

    case "bw":
      // Black & white klasik
      return `
        grayscale(${0.9 * i})
        contrast(${1 + 0.2 * i})
      `;

    case "vintage":
      // Vintage ala film lama
      return `
        sepia(${0.4 * i})
        saturate(${0.9 * i})
        contrast(${1 - 0.05 * i})
      `;

    case "cinematic":
      // Cinematic teal & orange vibe
      return `
        contrast(${1 + 0.15 * i})
        saturate(${1 + 0.05 * i})
        brightness(${1 - 0.05 * i})
      `;

    case "warm":
      // Warm, golden hour feel
      return `
        brightness(${1 + 0.05 * i})
        saturate(${1 + 0.2 * i})
        sepia(${0.1 * i})
      `;

    case "cool":
      // Cool, blueish mood
      return `
        brightness(${1 - 0.05 * i})
        saturate(${1 - 0.1 * i})
        hue-rotate(${20 * i}deg)
      `;

    case "drama":
      // High contrast, dark shadows
      return `
        contrast(${1 + 0.3 * i})
        brightness(${1 - 0.1 * i})
        saturate(${1 + 0.05 * i})
      `;

    default:
      return "none";
  }
}
