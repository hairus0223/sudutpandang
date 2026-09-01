/**
 * Verify bundled AI theme preview assets exist for all active theme IDs.
 *
 * Usage:
 *   npm run validate:ai-theme-previews
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getActiveAiThemes } from "../services/aiThemeCatalog.js";
import { BUNDLED_THEME_PREVIEWS_DIR } from "../services/aiThemePreviews.js";
import { BOOTH_BACKGROUND_THEME_IDS } from "../services/themeBackgroundSvgs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findAfterFile(themeId) {
  const dir = path.join(BUNDLED_THEME_PREVIEWS_DIR, themeId);
  if (!fs.existsSync(dir)) return null;

  for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
    const candidate = path.join(dir, `after${ext}`);
    if (fs.existsSync(candidate)) return path.relative(BUNDLED_THEME_PREVIEWS_DIR, candidate);
  }

  return null;
}

function main() {
  const themes = getActiveAiThemes();
  const requiredIds = new Set(BOOTH_BACKGROUND_THEME_IDS);

  console.log("\nAI theme preview validation\n");

  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const optionalMissing = [];

  for (const theme of themes) {
    const after = findAfterFile(theme.id);
    const required = requiredIds.has(theme.id);

    if (!after) {
      if (required) {
        missing.push(theme.id);
        console.log(`[MISSING] ${theme.id} (${theme.label}) — no after.* in bundled previews`);
      } else {
        optionalMissing.push(theme.id);
        console.log(`[WARN] ${theme.id} (${theme.label}) — no bundled preview (studio-only theme)`);
      }
      continue;
    }

    console.log(`[OK] ${theme.id} (transform) → ${after}`);
  }

  const requiredCount = BOOTH_BACKGROUND_THEME_IDS.length;
  const requiredOk = requiredCount - missing.length;
  console.log(
    `\nSummary: ${requiredOk}/${requiredCount} bundled booth themes with after preview`
  );

  if (optionalMissing.length > 0) {
    console.log(`Optional studio themes without bundled preview: ${optionalMissing.join(", ")}`);
  }

  if (missing.length > 0) {
    console.error(`\n❌ Missing previews for bundled themes: ${missing.join(", ")}`);
    console.error("   Fix: npm run generate:ai-theme-previews\n");
    process.exit(1);
  }

  console.log("\n✅ All bundled booth themes have preview assets.\n");
}

main();
