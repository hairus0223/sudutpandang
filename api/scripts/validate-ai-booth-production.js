/**
 * Production readiness check for bundled Pro Booth themes (PR-5 / Phase 3).
 *
 * Usage:
 *   npm run validate:ai-booth-production
 */
import {
  BUNDLED_AI_THEMES,
} from "../services/aiThemeCatalog.js";
import { validateBundledThemeBackgrounds } from "../services/aiThemeBackgrounds.js";
import { validateBundledThemeOverlays } from "../services/aiThemeOverlays.js";
import { BOOTH_BACKGROUND_THEME_IDS } from "../services/themeBackgroundSvgs.js";
import {
  evaluateThemeProduction,
  MIN_THEME_BACKGROUND_SHORT_EDGE,
  readImageSize,
} from "../services/aiThemeProduction.js";

async function main() {
  /** @type {string[]} */
  const issues = [];

  console.log("\nAI Pro Booth production validation (bundled themes)\n");

  const bgReport = validateBundledThemeBackgrounds();
  console.log(`Backgrounds: ${bgReport.themeIds.length - bgReport.missing.length}/${bgReport.themeIds.length}`);
  if (!bgReport.ok) {
    issues.push(`missing backgrounds: ${bgReport.missing.join(", ")}`);
  }

  const overlayReport = validateBundledThemeOverlays();
  console.log(
    `Overlays: ${overlayReport.themeIds.length - overlayReport.missing.length}/${overlayReport.themeIds.length}`
  );
  if (!overlayReport.ok) {
    issues.push(`missing overlays: ${overlayReport.missing.join(", ")}`);
  }

  let ready = 0;
  for (const themeId of BOOTH_BACKGROUND_THEME_IDS) {
    const theme = BUNDLED_AI_THEMES.find((entry) => entry.id === themeId);
    if (!theme) {
      issues.push(`bundled theme config missing: ${themeId}`);
      continue;
    }

    const report = evaluateThemeProduction(theme);
    if (report.backgroundPath) {
      const size = await readImageSize(report.backgroundPath);
      if (size.shortEdge < MIN_THEME_BACKGROUND_SHORT_EDGE) {
        report.issues.push(
          `background short edge ${size.shortEdge}px < ${MIN_THEME_BACKGROUND_SHORT_EDGE}`
        );
      }
    }

    if (report.issues.length === 0) {
      ready += 1;
      console.log(`[OK] ${themeId} look=${theme.lookId} before/after + photo bg`);
    } else {
      issues.push(`${themeId}: ${report.issues.join(", ")}`);
      console.log(`[WARN] ${themeId} — ${report.issues.join(", ")}`);
    }
  }
  console.log(`Theme production: ${ready}/${BOOTH_BACKGROUND_THEME_IDS.length}`);

  if (issues.length > 0) {
    console.error("\n❌ Production validation failed:");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    console.error("\nFix:");
    console.error("  npm run generate:theme-backgrounds");
    console.error("  npm run generate:theme-overlays");
    console.error("  npm run generate:ai-theme-previews\n");
    process.exit(1);
  }

  console.log("\n✅ All bundled Pro Booth themes are production-ready.\n");
}

main().catch((err) => {
  console.error("\n❌ Production validation failed:", err.message);
  process.exit(1);
});
