/** @typedef {'asset' | 'cache' | 'api' | 'gradient'} ThemeBackgroundSource */

const stats = {
  asset: 0,
  cache: 0,
  api: 0,
  gradient: 0,
};

/**
 * @param {ThemeBackgroundSource} source
 */
export function recordThemeBackgroundSource(source) {
  if (!(source in stats)) return;

  stats[source] += 1;

  if (source === "gradient") {
    console.warn(
      "[theme] Background fallback ke gradient — periksa asset bundled atau cache/API tema."
    );
  }
}

/**
 * @returns {{ asset: number, cache: number, api: number, gradient: number, total: number, gradientFallbackRate: number | null }}
 */
export function getThemeSourceStats() {
  const total = stats.asset + stats.cache + stats.api + stats.gradient;

  return {
    ...stats,
    total,
    gradientFallbackRate:
      total > 0 ? Math.round((stats.gradient / total) * 1000) / 1000 : null,
  };
}

export function resetThemeSourceStats() {
  stats.asset = 0;
  stats.cache = 0;
  stats.api = 0;
  stats.gradient = 0;
}
