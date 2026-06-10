export const PASSPORT_COLOR_OPTIONS = [
  { id: "white", label: "Putih", value: "#FFFFFF" },
  { id: "blue", label: "Biru", value: "#438CCB" },
  { id: "red", label: "Merah", value: "#CC0000" },
] as const;

export type PassportColorOption = (typeof PASSPORT_COLOR_OPTIONS)[number];

export const DEFAULT_PASSPORT_COLOR = PASSPORT_COLOR_OPTIONS[0].value;
