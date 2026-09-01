/**
 * Production readiness check for bundled Pro Booth themes (PR-5).
 *
 * Usage:
 *   npm run validate:ai-booth-production
 */
import fs from "fs";
import path from "path";
import {
  BUNDLED_AI_THEMES,
  isCompositePipelineMode,
} from "../services/aiThemeCatalog.js";
import {
  getBundledPhotoBackgroundPath,
  validateBundledThemeBackgrounds,
} from "../services/aiThemeBackgrounds.js";
import { BUNDLED_THEME_PREVIEWS_DIR } from "../services/aiThemePreviews.js";
import { validateBundledThemeOverlays } from "../services/aiThemeOverlays.js";
import { BOOTH_BACKGROUND_THEME_IDS } from "../services/themeBackgroundSvgs.js";

function findAfterPreview(themeId) {
  const dir = path.join(BUNDLED_THEME_PREVIEWS_DIR, themeId);
  if (!fs.existsSync(dir)) return null;

  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = path.join(dir, `after${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function main() {
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

  let previewOk = 0;
  for (const themeId of BOOTH_BACKGROUND_THEME_IDS) {
    const after = findAfterPreview(themeId);
    if (after) {
      previewOk += 1;
      console.log(`[OK] preview ${themeId} → ${path.basename(after)}`);
    } else {
      issues.push(`missing preview after.* for ${themeId}`);
      console.log(`[MISSING] preview ${themeId}`);
    }
  }
  console.log(`Previews: ${previewOk}/${BOOTH_BACKGROUND_THEME_IDS.length}`);

  let configOk = 0;
  for (const themeId of BOOTH_BACKGROUND_THEME_IDS) {
    const theme = BUNDLED_AI_THEMES.find((entry) => entry.id === themeId);
    if (!theme) {
      issues.push(`bundled theme config missing: ${themeId}`);
      continue;
    }

    const themeIssues = [];
    if (!isCompositePipelineMode(theme.pipelineMode ?? "direct")) {
      themeIssues.push("pipelineMode not composite");
    }
    if (!theme.lookId) themeIssues.push("lookId missing");
    if (!theme.placement) themeIssues.push("placement missing");
    if (!theme.overlays?.length) themeIssues.push("overlays missing");
    if (!getBundledPhotoBackgroundPath(themeId)) {
      themeIssues.push("bg.jpg missing");
    }

    if (themeIssues.length === 0) {
      configOk += 1;
      console.log(`[OK] config ${themeId} (look=${theme.lookId}, overlays=${theme.overlays?.length ?? 0})`);
    } else {
      issues.push(`${themeId}: ${themeIssues.join(", ")}`);
      console.log(`[WARN] config ${themeId} — ${themeIssues.join(", ")}`);
    }
  }
  console.log(`Theme config: ${configOk}/${BOOTH_BACKGROUND_THEME_IDS.length}`);

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

main();
