export const AI_THEME_OPTIONS = [
  { id: "studio-purple", label: "Studio Ungu", preview: "linear-gradient(135deg, #1a0a2e, #7c3aed)" },
  { id: "sunset-beach", label: "Pantai Sunset", preview: "linear-gradient(180deg, #f97316, #2563eb)" },
  { id: "neon-city", label: "Neon City", preview: "linear-gradient(45deg, #0f172a, #db2777)" },
  { id: "nature-forest", label: "Hutan", preview: "linear-gradient(160deg, #14532d, #4ade80)" },
  { id: "golden-hour", label: "Golden Hour", preview: "linear-gradient(120deg, #fbbf24, #f43f5e)" },
] as const;

export const DEFAULT_THEME_ID = AI_THEME_OPTIONS[0].id;
