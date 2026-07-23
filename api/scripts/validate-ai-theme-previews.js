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

  console.log("\nAI theme preview validation\n");

  /** @type {string[]} */
  const missing = [];

  for (const theme of themes) {
    const after = findAfterFile(theme.id);

    if (!after) {
      missing.push(theme.id);
      console.log(`[MISSING] ${theme.id} (${theme.label}) — no after.* in bundled previews`);
      continue;
    }

    console.log(`[OK] ${theme.id} (transform) → ${after}`);
  }

  console.log(
    `\nSummary: ${themes.length - missing.length}/${themes.length} themes with bundled after preview`
  );

  if (missing.length > 0) {
    console.error(`\n❌ Missing previews for: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("\n✅ All active AI themes have bundled preview assets.\n");
}

main();
