/**
 * Validate bundled portrait booth backgrounds (PR-1).
 *
 * Usage:
 *   npm run validate:theme-backgrounds
 */
import fs from "fs";
import {
  getBundledPhotoBackgroundPath,
  validateBundledThemeBackgrounds,
} from "../services/aiThemeBackgrounds.js";
import {
  BOOTH_BG_HEIGHT,
  BOOTH_BG_WIDTH,
} from "../services/themeBackgroundSvgs.js";

const MIN_BYTES = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;

function main() {
  const report = validateBundledThemeBackgrounds();
  /** @type {string[]} */
  const invalid = [];

  console.log("\nTheme background validation (portrait booth)\n");

  for (const themeId of report.themeIds) {
    const bgPath = getBundledPhotoBackgroundPath(themeId);
    const ok = Boolean(bgPath);
    const status = ok ? "OK" : "MISSING";
    let size = "—";

    if (bgPath) {
      const stat = fs.statSync(bgPath);
      size = `${Math.round(stat.size / 1024)} KB`;
      if (stat.size < MIN_BYTES || stat.size > MAX_BYTES) {
        invalid.push(`${themeId} (${size})`);
      }
    }

    console.log(`[${status}] ${themeId}/bg.jpg — ${size}`);
  }

  console.log(`\nExpected size: ${BOOTH_BG_WIDTH}×${BOOTH_BG_HEIGHT} (3:4 portrait)\n`);

  if (report.ok && invalid.length === 0) {
    console.log("✅ All bundled theme backgrounds are present.\n");
    return;
  }

  if (report.missing.length > 0) {
    console.error(`❌ Missing: ${report.missing.join(", ")}`);
  }
  if (invalid.length > 0) {
    console.error(`❌ Invalid size: ${invalid.join(", ")}`);
  }
  console.error("   Fix: npm run generate:theme-backgrounds\n");
  process.exit(1);
}

main();
