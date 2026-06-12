import type {
  ThemeCategoryMeta,
  ThemeGroup,
  ThemeOption,
} from "@/lib/imageTypes";

export const DEFAULT_THEME_ID = "wc2026-stadium-night";

/** Offline fallback when GET /api/themes is unavailable */
export const FALLBACK_THEME_CATEGORIES: ThemeCategoryMeta[] = [
  {
    id: "world-cup-2026",
    label: "Piala Dunia 2026",
    kind: "event",
    sortOrder: 10,
    pickerCompact: false,
    themeCount: 4,
    assetsReady: true,
    missingCount: 0,
  },
  {
    id: "classic",
    label: "Tema Klasik",
    kind: "permanent",
    sortOrder: 20,
    pickerCompact: true,
    themeCount: 5,
    assetsReady: true,
    missingCount: 0,
  },
];

export const FALLBACK_THEMES: ThemeOption[] = [
  {
    id: "wc2026-stadium-night",
    label: "Stadion Malam",
    category: "world-cup-2026",
    previewGradient: "linear-gradient(180deg, #020617, #166534)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "wc2026-celebration",
    label: "Perayaan Gol",
    category: "world-cup-2026",
    previewGradient: "linear-gradient(135deg, #1e1b4b, #b45309)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "wc2026-indonesia-pride",
    label: "Garuda Pride",
    category: "world-cup-2026",
    previewGradient: "linear-gradient(180deg, #b91c1c 50%, #f8fafc 50%)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "wc2026-victory",
    label: "Victory Pose",
    category: "world-cup-2026",
    previewGradient: "linear-gradient(120deg, #422006, #fbbf24)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "studio-purple",
    label: "Studio Ungu",
    category: "classic",
    previewGradient: "linear-gradient(135deg, #1a0a2e, #7c3aed)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "sunset-beach",
    label: "Pantai Sunset",
    category: "classic",
    previewGradient: "linear-gradient(180deg, #f97316, #2563eb)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "neon-city",
    label: "Neon City",
    category: "classic",
    previewGradient: "linear-gradient(45deg, #0f172a, #db2777)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "nature-forest",
    label: "Hutan",
    category: "classic",
    previewGradient: "linear-gradient(160deg, #14532d, #4ade80)",
    hasAsset: true,
    assetAvailable: true,
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    category: "classic",
    previewGradient: "linear-gradient(120deg, #fbbf24, #f43f5e)",
    hasAsset: true,
    assetAvailable: true,
  },
];

export type UiThemeOption = {
  id: string;
  label: string;
  preview: string;
  category: string;
  assetAvailable: boolean;
};

export function toUiThemeOptions(themes: ThemeOption[]): UiThemeOption[] {
  return themes.map((theme) => ({
    id: theme.id,
    label: theme.label,
    preview: theme.previewGradient,
    category: theme.category,
    assetAvailable: theme.assetAvailable,
  }));
}

/** @deprecated Prefer useThemes() + toUiThemeOptions */
export const AI_THEME_OPTIONS = toUiThemeOptions(FALLBACK_THEMES);

/** @deprecated Prefer useThemes() */
export const WC2026_THEME_OPTIONS = AI_THEME_OPTIONS.filter(
  (option) => option.category === "world-cup-2026"
);

export function filterThemesByCategory(
  themes: ThemeOption[],
  category: string
): ThemeOption[] {
  return themes.filter((theme) => theme.category === category);
}

export function groupThemesByCategory(
  themes: ThemeOption[],
  categories: ThemeCategoryMeta[] = FALLBACK_THEME_CATEGORIES
): ThemeGroup[] {
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return sorted
    .map((category) => ({
      ...category,
      themes: themes.filter((theme) => theme.category === category.id),
    }))
    .filter((group) => group.themes.length > 0);
}
