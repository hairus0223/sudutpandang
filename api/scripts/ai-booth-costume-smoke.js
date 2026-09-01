/**
 * Smoke test for Pro Booth composite-costume pipeline (PR-3).
 *
 * Usage:
 *   npm run smoke-test:ai-booth-costume          # dry — composite-only fallback check
 *   npm run smoke-test:ai-booth-costume -- --live # full costume pass (OpenAI billed)
 */
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { getAiTheme } from "../services/aiThemes.js";
import {
  isCostumePassAvailable,
  resolveEffectivePipeline,
  runCompositeBoothGeneration,
  runCompositeCostumeBoothGeneration,
} from "../services/aiProBooth.js";
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
  const live = process.argv.includes("--live");
  console.log(`\n🎭 AI booth costume smoke${live ? " (live OpenAI)" : ""}\n`);

  const status = getAiPipelineStatus();
  console.log(
    `pipeline=${status.pipeline} costume=${status.costumePassAvailable} maskedEdit=${status.maskedEditEnabled} faceRefine=${status.faceRefine?.enabled}`
  );

  const theme = getAiTheme("wild-west");
  if (!theme) throw new Error("wild-west theme missing");

  const effective = resolveEffectivePipeline(theme);
  console.log(`effectivePipeline=${effective}`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ai-booth-costume-"));
  const samplePath = path.join(root, "sample.jpg");
  const outputPath = path.join(root, "out.jpg");

  await createSamplePortrait(samplePath);

  const t0 = Date.now();

  if (live) {
    if (!isCostumePassAvailable()) {
      throw new Error(
        "Costume pass unavailable — set OPENAI_API_KEY, OPENAI_MASKED_EDIT_ENABLED=true, PERSON_SEGMENTATION_ENABLED=true"
      );
    }

    const { bgSource, pipeline, faceRefined } = await runCompositeCostumeBoothGeneration({
      sourcePath: samplePath,
      theme,
      outputPath,
      baseDir: process.env.BASE_DIR || path.join(os.homedir(), "SudutPandangStudio"),
    });

    const stat = fs.statSync(outputPath);
    console.log(
      `✓ ${pipeline} bg=${bgSource} faceRefined=${faceRefined} out=${Math.round(stat.size / 1024)}KB (${Date.now() - t0}ms)`
    );
  } else {
    const { bgSource, pipeline } = await runCompositeBoothGeneration({
      sourcePath: samplePath,
      theme,
      outputPath,
      baseDir: process.env.BASE_DIR || path.join(os.homedir(), "SudutPandangStudio"),
    });

    const stat = fs.statSync(outputPath);
    console.log(
      `✓ dry composite fallback ${pipeline} bg=${bgSource} out=${Math.round(stat.size / 1024)}KB (${Date.now() - t0}ms)`
    );
    console.log("  (pass --live to exercise masked costume + face refine + OpenAI)");
  }

  console.log("\n✅ AI booth costume smoke passed.\n");
}

main().catch((err) => {
  console.error("\n❌ AI booth costume smoke failed:", err.message);
  process.exit(1);
});
