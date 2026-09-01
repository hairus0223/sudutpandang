/**
 * Generate bundled portrait booth backgrounds.
 *
 * Usage:
 *   npm run generate:theme-backgrounds              # SVG fallback (free, dev)
 *   npm run generate:theme-backgrounds:openai       # photorealistic via OpenAI
 *   node scripts/generate-theme-backgrounds.js --openai --theme wild-west
 *   node scripts/generate-theme-backgrounds.js --openai --dry-run
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  BUNDLED_THEME_BACKGROUNDS_DIR,
  getBundledPhotoBackgroundPath,
} from "../services/aiThemeBackgrounds.js";
import {
  generateBoothBackgroundWithOpenAi,
  writeBoothBackgroundJpeg,
} from "../services/openaiBackgroundGen.js";
import { getBoothBackgroundPrompt } from "../services/themeBackgroundPrompts.js";
import {
  BOOTH_BACKGROUND_THEME_IDS,
  BOOTH_BG_HEIGHT,
  BOOTH_BG_WIDTH,
  getBoothBackgroundSvg,
} from "../services/themeBackgroundSvgs.js";

/**
 * @param {string} themeId
 */
async function renderSvgBackground(themeId) {
  const svg = getBoothBackgroundSvg(themeId);
  if (!svg) {
    throw new Error(`unknown_theme:${themeId}`);
  }

  const outPath = getBundledPhotoBackgroundPath(themeId) ??
    path.join(BUNDLED_THEME_BACKGROUNDS_DIR, themeId, "bg.jpg");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  await sharp(Buffer.from(svg))
    .resize(BOOTH_BG_WIDTH, BOOTH_BG_HEIGHT, { fit: "fill" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  return { outPath, sizeKb: Math.round(stat.size / 1024), source: "svg" };
}

/**
 * @param {string} themeId
 */
async function renderOpenAiBackground(themeId) {
  const outPath = getBundledPhotoBackgroundPath(themeId) ??
    path.join(BUNDLED_THEME_BACKGROUNDS_DIR, themeId, "bg.jpg");

  const { buffer } = await generateBoothBackgroundWithOpenAi({ themeId });
  await writeBoothBackgroundJpeg(outPath, buffer);

  const stat = fs.statSync(outPath);
  return { outPath, sizeKb: Math.round(stat.size / 1024), source: "openai" };
}

function parseArgs(argv) {
  /** @type {{ themeId?: string, openai: boolean, dryRun: boolean }} */
  const args = { openai: false, dryRun: false };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--theme" && argv[i + 1]) {
      args.themeId = argv[i + 1];
      i += 1;
      continue;
    }
    if (argv[i] === "--openai") {
      args.openai = true;
      continue;
    }
    if (argv[i] === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

async function main() {
  const { themeId, openai, dryRun } = parseArgs(process.argv);
  const themeIds = themeId ? [themeId] : BOOTH_BACKGROUND_THEME_IDS;
  const mode = openai ? "openai" : "svg";

  console.log(`\n[Theme Backgrounds:${mode}] → ${BUNDLED_THEME_BACKGROUNDS_DIR}\n`);

  if (dryRun && openai) {
    for (const id of themeIds) {
      const spec = getBoothBackgroundPrompt(id);
      console.log(`--- ${id} (${spec?.label}) ---`);
      console.log(spec?.prompt ?? "(missing prompt)");
      console.log("");
    }
    return;
  }

  for (const id of themeIds) {
    const t0 = Date.now();
    const result = openai
      ? await renderOpenAiBackground(id)
      : await renderSvgBackground(id);
    console.log(
      `  ✓ ${path.relative(BUNDLED_THEME_BACKGROUNDS_DIR, result.outPath)} (${result.sizeKb} KB, ${result.source}, ${Date.now() - t0}ms)`
    );

    if (openai && themeIds.length > 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n❌ generate-theme-backgrounds failed:", err.message);
  process.exit(1);
});
