"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchThemes } from "@/services/image.service";
import {
  DEFAULT_THEME_ID,
  FALLBACK_THEME_CATEGORIES,
  FALLBACK_THEMES,
  filterThemesByCategory,
  groupThemesByCategory,
} from "@/lib/aiThemes";
import type { ThemeCategoryMeta, ThemeGroup, ThemeOption } from "@/lib/imageTypes";

type UseThemesResult = {
  themes: ThemeOption[];
  categories: ThemeCategoryMeta[];
  themeGroups: ThemeGroup[];
  defaultThemeId: string;
  loading: boolean;
  fromApi: boolean;
  /** @deprecated Use themeGroups */
  worldCupThemes: ThemeOption[];
  /** @deprecated Use themeGroups */
  classicThemes: ThemeOption[];
};

export function useThemes(): UseThemesResult {
  const [themes, setThemes] = useState<ThemeOption[]>(FALLBACK_THEMES);
  const [categories, setCategories] = useState<ThemeCategoryMeta[]>(
    FALLBACK_THEME_CATEGORIES
  );
  const [defaultThemeId, setDefaultThemeId] = useState(DEFAULT_THEME_ID);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchThemes()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.themes) && data.themes.length > 0) {
          setThemes(data.themes);
          setDefaultThemeId(data.defaultThemeId || DEFAULT_THEME_ID);
          setFromApi(true);
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFromApi(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const themeGroups = useMemo(
    () => groupThemesByCategory(themes, categories),
    [themes, categories]
  );

  return {
    themes,
    categories,
    themeGroups,
    defaultThemeId,
    loading,
    fromApi,
    worldCupThemes: filterThemesByCategory(themes, "world-cup-2026"),
    classicThemes: filterThemesByCategory(themes, "classic"),
  };
}
