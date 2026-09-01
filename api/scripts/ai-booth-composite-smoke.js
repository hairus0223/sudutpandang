/**
 * Smoke test for Pro Booth composite-only pipeline (PR-2).
 *
 * Usage:
 *   npm run smoke-test:ai-booth
 */
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { getAiTheme } from "../services/aiThemes.js";
import { isCompositeBoothAvailable, runCompositeBoothGeneration } from "../services/aiProBooth.js";
import { getAiPipelineStatus } from "../services/aiGeneration.js";

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
  console.log("\n🎭 AI booth composite smoke\n");

  const status = getAiPipelineStatus();
  console.log(`pipeline=${status.pipeline} compositeAvailable=${status.compositeBoothAvailable}`);

  if (!isCompositeBoothAvailable()) {
    throw new Error(
      "Composite booth unavailable — enable PERSON_SEGMENTATION_ENABLED and npm install @imgly/background-removal-node"
    );
  }

  const theme = getAiTheme("wild-west");
  if (!theme) throw new Error("wild-west theme missing");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ai-booth-"));
  const samplePath = path.join(root, "sample.jpg");
  const outputPath = path.join(root, "out.jpg");

  await createSamplePortrait(samplePath);

  const t0 = Date.now();
  const { bgSource, pipeline, overlaysApplied } = await runCompositeBoothGeneration({
    sourcePath: samplePath,
    theme,
    outputPath,
    baseDir: process.env.BASE_DIR || path.join(os.homedir(), "SudutPandangStudio"),
  });

  const stat = fs.statSync(outputPath);
  console.log(
    `✓ composite ${pipeline} bg=${bgSource} overlays=${overlaysApplied ? "yes" : "no"} out=${Math.round(stat.size / 1024)}KB (${Date.now() - t0}ms)`
  );
  console.log("\n✅ AI booth composite smoke passed.\n");
}

main().catch((err) => {
  console.error("\n❌ AI booth composite smoke failed:", err.message);
  process.exit(1);
});
