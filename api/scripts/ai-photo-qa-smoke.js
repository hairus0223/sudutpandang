/**
 * Phase 4 studio QA: functional gates + composite quality harness.
 *
 * Usage:
 *   npm run smoke-test:ai-photo-qa
 *   npm run smoke-test:ai-photo-qa -- --skip-quality
 *
 * Visual 5×2 identity/pose/halo still needs a live studio pass (printed at the end).
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { getAiTheme, listAiThemes } from "../services/aiThemes.js";
import { isThemeSelectableForRegister } from "../services/aiThemeProduction.js";
import {
  isCompositeBoothAvailable,
  runCompositeBoothGeneration,
} from "../services/aiProBooth.js";
import { getAiThemedPath } from "../services/imageStorage.js";
import {
  recoverIncompleteAiJobs,
  releaseAiQuota,
  reserveAiQuota,
  resolveAiRegisterTheme,
  setSessionTheme,
  writeCustomerJson,
} from "../services/aiCustomer.js";
import { resolveAiGenerateLimit } from "../services/packageTypes.js";
import { readCustomerJson } from "../services/customerConfig.js";
import { resolveBaseDir } from "../services/studioPaths.js";

const PRINT_4R_WIDTH = 4 * 300;
const PRINT_4R_HEIGHT = 6 * 300;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function expectThrow(fn, code) {
  try {
    fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === code) return;
    throw new Error(`expected ${code}, got ${message}`);
  }
  throw new Error(`expected ${code} but nothing was thrown`);
}

async function expectThrowAsync(fn, code) {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === code) return;
    throw new Error(`expected ${code}, got ${message}`);
  }
  throw new Error(`expected ${code} but nothing was thrown`);
}

function writeAiCustomer(userDir, overrides = {}) {
  fs.mkdirSync(userDir, { recursive: true });
  const peopleCount = overrides.peopleCount ?? 2;
  const data = {
    name: "QA User",
    peopleCount,
    user: path.basename(userDir),
    packageType: "ai-self-photo",
    aiGenerateLimit: resolveAiGenerateLimit("ai-self-photo", peopleCount),
    aiGenerateUsed: 0,
    aiThemeId: "wild-west",
    aiThemeLockedAt: new Date().toISOString(),
    aiSelections: [],
    ...overrides,
  };
  writeCustomerJson(userDir, data);
  return data;
}

async function createPortrait(outPath, variant = 0) {
  const cx = 360 + (variant % 3) * 40;
  const cy = 300 + (variant % 2) * 40;
  const skin = ["#fde68a", "#f5c6a0", "#d4a574", "#8d5524", "#f3e0c8"][variant % 5];
  const shirt = ["#3b82f6", "#dc2626", "#16a34a", "#7c3aed", "#0f172a"][variant % 5];
  const svg = `<svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="1200" fill="#cbd5e1"/>
    <ellipse cx="${cx}" cy="${cy}" rx="120" ry="150" fill="${skin}"/>
    <rect x="${cx - 120}" y="${cy + 160}" width="240" height="420" rx="40" fill="${shirt}"/>
    <rect x="${cx - 80}" y="${cy + 580}" width="70" height="220" fill="#1e293b"/>
    <rect x="${cx + 10}" y="${cy + 580}" width="70" height="220" fill="#1e293b"/>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(outPath);
}

async function centerLumaStddev(filePath) {
  const { data, info } = await sharp(filePath)
    .resize(200, 300, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += data[i];
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < n; i += 1) {
    const d = data[i] - mean;
    varSum += d * d;
  }
  return Math.sqrt(varSum / n);
}

function runFunctional() {
  console.log("Functional");

  expectThrow(() => resolveAiRegisterTheme(null), "theme_required");
  expectThrow(() => resolveAiRegisterTheme(""), "theme_required");
  expectThrow(() => resolveAiRegisterTheme("not-a-real-theme"), "theme_required");
  const theme = resolveAiRegisterTheme("wild-west");
  assert(theme.id === "wild-west", "wild-west should be selectable for register");
  console.log("  ✓ register without theme rejected; production theme accepted");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ai-qa-fn-"));
  const userDir = path.join(root, "QA_Quota");
  writeAiCustomer(userDir, { peopleCount: 2, aiThemeId: "wild-west" });

  const limit = resolveAiGenerateLimit("ai-self-photo", 2);
  assert(limit === 2, "quota must equal people count");

  reserveAiQuota(userDir);
  reserveAiQuota(userDir);
  expectThrow(() => reserveAiQuota(userDir), "quota_exhausted");
  releaseAiQuota(userDir);
  reserveAiQuota(userDir);
  console.log("  ✓ quota = people; limit+1 rejected; fail/release restores a slot");

  expectThrow(() => setSessionTheme(userDir, "k-pop-idol"), "theme_locked");
  console.log("  ✓ gallery cannot change a registered theme");

  const day = "2099-01-01";
  const recoverUser = path.join(root, day, "Stuck_Job");
  writeAiCustomer(recoverUser, {
    peopleCount: 1,
    aiGenerateUsed: 1,
    aiSelections: [
      {
        imageId: "cap-1",
        themeId: "wild-west",
        jobId: "job-stuck",
        status: "processing",
        phase: "costume",
      },
    ],
  });

  const recovered = recoverIncompleteAiJobs({
    baseDir: root,
    todayFolder: day,
  });
  assert(recovered.length === 1, `expected 1 recovered job, got ${recovered.length}`);
  const after = readCustomerJson(recoverUser);
  assert(after.aiGenerateUsed === 0, "restart recovery must release quota");
  assert(after.aiSelections[0].status === "failed", "stuck job must not stay processing");
  assert(after.aiSelections[0].errorCode === "job_interrupted", "errorCode job_interrupted");
  console.log("  ✓ restart marks incomplete jobs failed and releases quota");

  const origDir = path.join(root, "orig-check");
  fs.mkdirSync(path.join(origDir, "captures"), { recursive: true });
  const originalPath = path.join(origDir, "captures", "shot-1.jpg");
  fs.writeFileSync(originalPath, Buffer.from("original-bytes-must-stay"));
  const beforeHash = sha256File(originalPath);
  const aiPath = getAiThemedPath(origDir, "shot-1", "wild-west");
  fs.mkdirSync(path.dirname(aiPath), { recursive: true });
  fs.writeFileSync(aiPath, Buffer.from("ai-result-bytes"));
  assert(sha256File(originalPath) === beforeHash, "AI output must not overwrite original");
  assert(aiPath !== originalPath, "AI path must be processed/ai-{theme}.jpg");
  console.log("  ✓ AI result writes beside original, not over it");
}

async function runQuality() {
  console.log("Quality harness (synthetic 5 photos × 2 themes, composite-only)");

  if (!isCompositeBoothAvailable()) {
    throw new Error(
      "Composite booth unavailable — enable PERSON_SEGMENTATION_ENABLED"
    );
  }

  const baseDir = resolveBaseDir();
  const themes = listAiThemes(baseDir)
    .filter((theme) => isThemeSelectableForRegister(theme, baseDir))
    .slice(0, 2);

  assert(themes.length === 2, `need 2 selectable production themes, got ${themes.length}`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ai-qa-ql-"));
  const portraits = [];
  for (let i = 0; i < 5; i += 1) {
    const filePath = path.join(root, `portrait-${i + 1}.jpg`);
    await createPortrait(filePath, i);
    portraits.push(filePath);
  }

  for (const theme of themes) {
    for (let i = 0; i < portraits.length; i += 1) {
      const sourcePath = portraits[i];
      const originalHash = sha256File(sourcePath);
      const outputPath = path.join(root, theme.id, `out-${i + 1}.jpg`);
      const t0 = Date.now();
      await runCompositeBoothGeneration({
        sourcePath,
        theme: getAiTheme(theme.id, baseDir),
        outputPath,
        baseDir,
      });

      assert(fs.existsSync(outputPath), `${theme.id} missing output for portrait ${i + 1}`);
      assert(sha256File(sourcePath) === originalHash, "source JPEG mutated");

      const srcMeta = await sharp(sourcePath).metadata();
      const outMeta = await sharp(outputPath).metadata();
      assert(outMeta.format === "jpeg", "print file must be JPEG");
      assert(outMeta.width === srcMeta.width, "output width must match source");
      assert(outMeta.height === srcMeta.height, "output height must match source");
      assert(sha256File(outputPath) !== originalHash, "result should differ from original");

      const printBuf = await sharp(outputPath)
        .resize(PRINT_4R_WIDTH, PRINT_4R_HEIGHT, { fit: "cover" })
        .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
        .toBuffer();
      const printMeta = await sharp(printBuf).metadata();
      assert(
        printMeta.width === PRINT_4R_WIDTH && printMeta.height === PRINT_4R_HEIGHT,
        "4R @300 DPI resize failed"
      );

      const std = await centerLumaStddev(outputPath);
      assert(std > 8, `result looks empty/flat (luma stddev=${std.toFixed(1)})`);

      console.log(
        `  ✓ ${theme.id} portrait ${i + 1} ${Math.round(fs.statSync(outputPath).size / 1024)}KB ${Date.now() - t0}ms`
      );
    }
  }
}

function printStudioChecklist() {
  console.log(`
Studio visual checklist (5 live photos × 2 themes — not covered by synthetic smoke):
  [ ] 5/5 identity vs original (operator + second person)
  [ ] Pose / hands unchanged
  [ ] Background = theme asset, no studio wall leftover
  [ ] No halo on hair/shoulders
  [ ] Lighting matches theme (not a sticker)
  [ ] 4R print sharp, color close to screen
  [ ] Progress never silent >3s (heartbeat)
  [ ] Timeout/fail shows retry
  [ ] Kiosk can still capture while gallery is open
`);
}

async function main() {
  const skipQuality = process.argv.includes("--skip-quality");
  console.log("\n🧪 AI Photo Phase 4 QA\n");

  runFunctional();
  if (!skipQuality) {
    await runQuality();
  } else {
    console.log("Quality skipped (--skip-quality)");
  }

  printStudioChecklist();
  console.log("✅ Phase 4 QA smoke passed.\n");
}

main().catch((err) => {
  console.error("\n❌ Phase 4 QA smoke failed:", err.message);
  process.exit(1);
});
