export type PaperMarginsMm = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type PaperPreset = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  marginMm: PaperMarginsMm;
};

export const PAPER_PRESETS: PaperPreset[] = [
  {
    id: "A4",
    label: "A4",
    widthMm: 210,
    heightMm: 297,
    dpi: 300,
    marginMm: { top: 10, right: 10, bottom: 10, left: 10 },
  },
  {
    id: "Letter",
    label: 'Letter (8.5×11")',
    widthMm: 215.9,
    heightMm: 279.4,
    dpi: 300,
    marginMm: { top: 10, right: 10, bottom: 10, left: 10 },
  },
];

export function getPaperPreset(id: string): PaperPreset {
  return PAPER_PRESETS.find((preset) => preset.id === id) ?? PAPER_PRESETS[0];
}
