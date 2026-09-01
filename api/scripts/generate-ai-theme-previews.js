/**
 * Generate registration preview after.jpg for bundled booth themes (PR-5).
 * Composites stylized silhouette + bg + placement + prop overlay.
 *
 * Usage:
 *   npm run generate:ai-theme-previews
 *   node scripts/generate-ai-theme-previews.js --theme wild-west
 */
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { BUNDLED_AI_THEMES } from "../services/aiThemeCatalog.js";
import {
  getBundledPhotoBackgroundPath,
} from "../services/aiThemeBackgrounds.js";
import { BUNDLED_THEME_PREVIEWS_DIR } from "../services/aiThemePreviews.js";
import { applyThemePropOverlays } from "../services/aiThemeOverlays.js";
import { writePlacedSubjectFile } from "../services/aiThemePlacement.js";
import { compositeSubject } from "../services/imageComposite.js";
import { normalizeLookId } from "../services/lookPresets.js";
import {
  BOOTH_BACKGROUND_THEME_IDS,
} from "../services/themeBackgroundSvgs.js";

const PREVIEW_WIDTH = 1024;
const PREVIEW_HEIGHT = 1536;

/**
 * @param {string} accent
 */
function createSampleSubjectSvg(accent) {
  return `<svg width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${PREVIEW_WIDTH / 2}" cy="395" rx="151" ry="189" fill="#f5d0a9"/>
    <path d="M ${PREVIEW_WIDTH * 0.35} 598 Q ${PREVIEW_WIDTH / 2} 548 ${PREVIEW_WIDTH * 0.65} 598 L ${PREVIEW_WIDTH * 0.65} 1125 Q ${PREVIEW_WIDTH / 2} 1175 ${PREVIEW_WIDTH * 0.35} 1125 Z" fill="${accent}"/>
    <rect x="${PREVIEW_WIDTH * 0.39}" y="1125" width="102" height="332" rx="26" fill="#1e293b"/>
    <rect x="${PREVIEW_WIDTH * 0.51}" y="1125" width="102" height="332" rx="26" fill="#1e293b"/>
    <ellipse cx="${PREVIEW_WIDTH / 2}" cy="382" rx="121" ry="70" fill="#4a3728" opacity="0.85"/>
  </svg>`;
}

const SUBJECT_ACCENTS = {
  "wild-west": "#92400e",
  "cyberpunk-neon": "#1e293b",
  "royal-fantasy": "#7c2d12",
  "k-pop-idol": "#ec4899",
  "vintage-glam": "#854d0e",
  "anime-hero": "#6366f1",
};

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
 * @param {import("../services/aiThemeCatalog.js").AiTheme} theme
 */
async function renderThemePreview(theme) {
  const bgPath = getBundledPhotoBackgroundPath(theme.id);
  if (!bgPath) {
    throw new Error(`background_missing:${theme.id}`);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-preview-"));
  const subjectPath = path.join(root, "subject.png");
  const placedPath = path.join(root, "placed.png");
  const compositePath = path.join(root, "composite.png");

  const accent = SUBJECT_ACCENTS[theme.id] ?? "#64748b";
  await sharp(Buffer.from(createSampleSubjectSvg(accent)))
    .png()
    .toFile(subjectPath);

  await writePlacedSubjectFile(
    subjectPath,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    theme.placement,
    placedPath
  );

  const lookId = normalizeLookId(theme.lookId ?? "warm", "ai-photo");

  await compositeSubject({
    subjectPath: placedPath,
    outputPath: compositePath,
    background: { type: "image", path: bgPath },
    harmonizeOptions: { harmonize: true, lookId },
  });

  const withOverlays = await applyThemePropOverlays(
    compositePath,
    theme,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT
  );

  const outDir = path.join(BUNDLED_THEME_PREVIEWS_DIR, theme.id);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "after.jpg");

  await sharp(withOverlays)
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath);

  await fs.promises.rm(root, { recursive: true, force: true });

  const stat = fs.statSync(outPath);
  return { outPath, sizeKb: Math.round(stat.size / 1024) };
}

async function main() {
  const { themeId } = parseArgs(process.argv);
  const themeIds = themeId ? [themeId] : BOOTH_BACKGROUND_THEME_IDS;
  const themeMap = new Map(BUNDLED_AI_THEMES.map((theme) => [theme.id, theme]));

  console.log(`\n[AI Theme Previews] → ${BUNDLED_THEME_PREVIEWS_DIR}\n`);

  for (const id of themeIds) {
    const theme = themeMap.get(id);
    if (!theme) {
      throw new Error(`theme_not_found:${id}`);
    }

    const t0 = Date.now();
    const result = await renderThemePreview(theme);
    console.log(
      `  ✓ ${path.relative(BUNDLED_THEME_PREVIEWS_DIR, result.outPath)} (${result.sizeKb} KB, ${Date.now() - t0}ms)`
    );
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n❌ generate-ai-theme-previews failed:", err.message);
  process.exit(1);
});
