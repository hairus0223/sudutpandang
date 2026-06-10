export type PhotoSizePreset = {
  id: string;
  label: string;
  widthInch: number;
  heightInch: number;
};

export const CUSTOM_PHOTO_SIZE_ID = "custom";

export const PHOTO_SIZE_PRESETS: PhotoSizePreset[] = [
  {
    id: "2x3",
    label: '2×3" (5×7.6 cm)',
    widthInch: 2,
    heightInch: 3,
  },
  {
    id: "3x4",
    label: '3×4" (7.6×10 cm)',
    widthInch: 3,
    heightInch: 4,
  },
  {
    id: "4x6",
    label: '4×6" (10×15 cm)',
    widthInch: 4,
    heightInch: 6,
  },
  {
    id: "10x15",
    label: "10×15 cm",
    widthInch: 100 / 25.4,
    heightInch: 150 / 25.4,
  },
];

export function getPhotoSizePreset(id: string): PhotoSizePreset {
  return PHOTO_SIZE_PRESETS.find((preset) => preset.id === id) ?? PHOTO_SIZE_PRESETS[0];
}

export function createPhotoSizeFromMm(widthMm: number, heightMm: number): PhotoSizePreset {
  const w = Math.max(10, Math.min(300, widthMm));
  const h = Math.max(10, Math.min(400, heightMm));

  return {
    id: CUSTOM_PHOTO_SIZE_ID,
    label: `${Math.round(w)}×${Math.round(h)} mm`,
    widthInch: w / 25.4,
    heightInch: h / 25.4,
  };
}
