"use client";

import { useEffect, useState } from "react";
import type { AiTheme } from "@/lib/imageTypes";
import { fetchAiThemes } from "@/services/ai.service";
import {
  ThemePickerHint,
  ThemePreviewCard,
  ThemePreviewCardSkeleton,
} from "@/components/kiosk/ThemePreviewCard";
import { isAiThemeSelectable } from "@/lib/aiUiCopy";

type ThemePickerGridProps = {
  selectedThemeId: string | null;
  onSelect: (themeId: string) => void;
  onExpand?: (theme: AiTheme) => void;
  onError?: (message: string) => void;
};

export function ThemePickerGrid({
  selectedThemeId,
  onSelect,
  onExpand,
  onError,
}: ThemePickerGridProps) {
  const [themes, setThemes] = useState<AiTheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAiThemes()
      .then((res) => {
        setThemes(res.themes);
        const ready = res.themes.filter(isAiThemeSelectable);
        if (!selectedThemeId && ready[0]) {
          onSelect(ready[0].id);
        }
      })
      .catch(() => onError?.("Gagal memuat tema AI."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only load once on mount
  }, [onError]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ThemePreviewCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/50">
        Tidak ada tema AI tersedia.
      </p>
    );
  }

  if (!themes.some(isAiThemeSelectable)) {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-8 text-center text-sm text-amber-100/80">
        Tema belum punya preview atau background. Hubungi staf.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ThemePickerHint />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((theme) => (
          <ThemePreviewCard
            key={theme.id}
            theme={theme}
            selected={selectedThemeId === theme.id}
            onSelect={() => {
              if (!isAiThemeSelectable(theme)) return;
              onSelect(theme.id);
            }}
            onExpand={
              onExpand && isAiThemeSelectable(theme)
                ? () => onExpand(theme)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export function useAiThemes() {
  const [themes, setThemes] = useState<AiTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAiThemes()
      .then((res) => setThemes(res.themes))
      .catch(() => setError("Gagal memuat tema AI."))
      .finally(() => setLoading(false));
  }, []);

  return { themes, loading, error };
}
