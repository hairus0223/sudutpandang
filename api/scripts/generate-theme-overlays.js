/**
 * Generate bundled prop/frame overlay PNGs for Pro Booth themes (PR-5).
 *
 * Usage:
 *   npm run generate:theme-overlays
 *   node scripts/generate-theme-overlays.js --theme wild-west
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  BUNDLED_THEME_OVERLAYS_DIR,
} from "../services/aiThemeOverlays.js";
import {
  BOOTH_BACKGROUND_THEME_IDS,
} from "../services/themeBackgroundSvgs.js";
import { getThemeOverlayFrameSvg } from "../services/themeOverlaySvgs.js";

function parseArgs(argv) {
  /** @type {{ themeId?: string }} */
  const args = {};

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--theme" && argv[i + 1]) {
      args.themeId = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

/**
 * @param {string} themeId
 */
async function renderThemeOverlay(themeId) {
  const svg = getThemeOverlayFrameSvg(themeId);
  if (!svg) {
    throw new Error(`unknown_theme:${themeId}`);
  }

  const outDir = path.join(BUNDLED_THEME_OVERLAYS_DIR, themeId);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "frame.png");

  await sharp(Buffer.from(svg)).png({ compressionLevel: 6, effort: 8 }).toFile(outPath);

  const stat = fs.statSync(outPath);
  return { outPath, sizeKb: Math.round(stat.size / 1024) };
}

async function main() {
  const { themeId } = parseArgs(process.argv);
  const themeIds = themeId ? [themeId] : BOOTH_BACKGROUND_THEME_IDS;

  console.log(`\n[Theme Overlays] → ${BUNDLED_THEME_OVERLAYS_DIR}\n`);

  for (const id of themeIds) {
    const t0 = Date.now();
    const result = await renderThemeOverlay(id);
    console.log(
      `  ✓ ${path.relative(BUNDLED_THEME_OVERLAYS_DIR, result.outPath)} (${result.sizeKb} KB, ${Date.now() - t0}ms)`
    );
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n❌ generate-theme-overlays failed:", err.message);
  process.exit(1);
});
