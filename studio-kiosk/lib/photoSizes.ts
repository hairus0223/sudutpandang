export type PhotoSizePreset = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export const CUSTOM_PHOTO_SIZE_ID = "custom";

export const PHOTO_SIZE_PRESETS: PhotoSizePreset[] = [
  {
    id: "2x3",
    label: "2×3 cm",
    widthMm: 20,
    heightMm: 30,
  },
  {
    id: "3x4",
    label: "3×4 cm",
    widthMm: 30,
    heightMm: 40,
  },
  {
    id: "4x6",
    label: "4×6 cm",
    widthMm: 40,
    heightMm: 60,
  },
  {
    id: "10x15",
    label: "10×15 cm",
    widthMm: 100,
    heightMm: 150,
  },
];

export const DEFAULT_PASSPORT_SIZE_ID = "3x4";

export function getPhotoSizePreset(id: string): PhotoSizePreset {
  return PHOTO_SIZE_PRESETS.find((preset) => preset.id === id) ?? PHOTO_SIZE_PRESETS[1];
}

export function createPhotoSizeFromMm(widthMm: number, heightMm: number): PhotoSizePreset {
  const w = Math.max(10, Math.min(300, widthMm));
  const h = Math.max(10, Math.min(400, heightMm));

  return {
    id: CUSTOM_PHOTO_SIZE_ID,
    label: `${Math.round(w)}×${Math.round(h)} mm`,
    widthMm: w,
    heightMm: h,
  };
}

export function getPassportSizeAspect(sizeId: string): string {
  const preset = getPhotoSizePreset(sizeId);
  return `${preset.widthMm} / ${preset.heightMm}`;
}
