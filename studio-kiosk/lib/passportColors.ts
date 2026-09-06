export const PASSPORT_COLOR_OPTIONS = [
  { id: "red", label: "Merah", value: "#CC0000" },
  { id: "blue", label: "Biru", value: "#438CCB" },
] as const;

export type PassportColorOption = (typeof PASSPORT_COLOR_OPTIONS)[number];

export const DEFAULT_PASSPORT_COLOR = PASSPORT_COLOR_OPTIONS[1].value;

export function normalizePassportColor(input?: string | null): string {
  if (!input) return DEFAULT_PASSPORT_COLOR;
  const raw = input.trim();
  const preset = PASSPORT_COLOR_OPTIONS.find(
    (option) => option.id === raw.toLowerCase() || option.value === raw.toUpperCase()
  );
  if (preset) return preset.value;
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  return DEFAULT_PASSPORT_COLOR;
}
