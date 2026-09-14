/**
 * Smoke test for Foto Tema (theme-self-photo): composite-only, no OpenAI,
 * original file unchanged, print JPEG without frame overlay.
 *
 * Usage:
 *   npm run smoke-test:theme-photo
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { isCompositeBoothAvailable } from "../services/aiProBooth.js";
import { getAiTheme } from "../services/aiThemes.js";
import {
  createPendingMeta,
  getCapturePath,
  getThemePhotoPath,
  readMeta,
} from "../services/imageStorage.js";
import { runThemePhotoPipeline } from "../services/themePhotoPipeline.js";

const THEME_ID = "wild-west";

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function createSamplePortrait(outPath) {
  const svg = `<svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="1200" fill="#cbd5e1"/>
    <ellipse cx="400" cy="340" rx="120" ry="150" fill="#fde68a"/>
    <rect x="280" y="500" width="240" height="420" rx="40" fill="#3b82f6"/>
    <rect x="320" y="920" width="70" height="220" fill="#1e293b"/>
    <rect x="410" y="920" width="70" height="220" fill="#1e293b"/>
  </svg>`;

  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(outPath);
}

async function main() {
  console.log("\n🖼️  Foto Tema composite smoke\n");

  if (!isCompositeBoothAvailable()) {
    throw new Error(
      "Composite booth unavailable — enable PERSON_SEGMENTATION_ENABLED and npm install @imgly/background-removal-node"
    );
  }

  const baseDir = process.env.BASE_DIR || path.join(os.homedir(), "SudutPandangStudio");
  const theme = getAiTheme(THEME_ID, baseDir);
  if (!theme) throw new Error(`${THEME_ID} theme missing`);

  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-theme-photo-"));
  const imageId = "smoke-theme-001";
  fs.writeFileSync(
    path.join(userDir, "customer.json"),
    JSON.stringify({
      name: "Theme Smoke",
      packageType: "theme-self-photo",
      aiThemeId: THEME_ID,
    })
  );

  const originalPath = getCapturePath(userDir, imageId, ".jpg");
  fs.mkdirSync(path.dirname(originalPath), { recursive: true });
  await createSamplePortrait(originalPath);
  const originalHash = sha256(originalPath);

  createPendingMeta({
    userDir,
    imageId,
    sourceFilename: `${imageId}.jpg`,
    ext: ".jpg",
    processingPhase: "compositing",
  });

  const t0 = Date.now();
  await runThemePhotoPipeline({
    userDir,
    imageId,
    user: "theme-smoke",
    io: { emit() {} },
    buildPublicUrl: (relativePath) => relativePath,
    baseDir,
  });

  const afterHash = sha256(originalPath);
  if (afterHash !== originalHash) {
    throw new Error("original capture was modified — identity/print source must stay untouched");
  }

  const themePath = getThemePhotoPath(userDir, imageId, THEME_ID);
  if (!fs.existsSync(themePath)) {
    throw new Error(`theme jpeg missing: ${themePath}`);
  }

  const info = await sharp(themePath).metadata();
  if (info.format !== "jpeg") {
    throw new Error(`expected jpeg, got ${info.format}`);
  }

  const meta = readMeta(userDir, imageId);
  if (!meta?.variants?.theme) {
    throw new Error("meta.variants.theme missing");
  }
  if (Array.isArray(theme.overlays) && theme.overlays.length > 0) {
    console.log(
      `  (catalog still lists ${theme.overlays.length} overlay(s); pipeline forces overlays=[])`
    );
  }

  console.log(
    `✓ composite theme=${THEME_ID} out=${Math.round(fs.statSync(themePath).size / 1024)}KB ` +
      `${info.width}×${info.height} (${Date.now() - t0}ms)`
  );
  console.log("✓ original capture hash unchanged");
  console.log("\n✅ Foto Tema smoke passed.\n");
}

main().catch((err) => {
  console.error("\n❌ Foto Tema smoke failed:", err.message);
  process.exit(1);
});
