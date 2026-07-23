/**
 * Smoke test for hybrid AI pipeline v2 (segment → edit → composite).
 *
 * Usage:
 *   npm run smoke-test:ai-hybrid           # dry-run composite wiring (no OpenAI)
 *   npm run smoke-test:ai-hybrid -- --live # full pipeline with OpenAI
 */
import fs from "fs";
import os from "os";
import path from "path";
import url from "url";
import sharp from "sharp";
import {
  isHybridPipelineAvailable,
  runAiGeneration,
} from "../services/aiGeneration.js";
import { buildCompositeSubjectFromEdited } from "../services/personMask.js";
import { resolveAiThemeBackground } from "../services/aiThemeBackgrounds.js";
import { compositeSubject } from "../services/imageComposite.js";
import { segmentAndSaveArtifacts } from "../services/personSegmentation.js";
import { getCapturesDir } from "../services/imageStorage.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SAMPLE_IMAGE = path.join(
  __dirname,
  "..",
  "assets",
  "ai-theme-previews",
  "wild-west",
  "before.png"
);

function parseArgs(argv) {
  return { live: argv.includes("--live") };
}

async function createTempUserDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ai-hybrid-"));
  const userDir = path.join(root, "01-01-2026", "smoke-user");
  const capturesDir = getCapturesDir(userDir);
  fs.mkdirSync(capturesDir, { recursive: true });

  const imageId = "smoke-ai-hybrid";
  const capturePath = path.join(capturesDir, `${imageId}.jpg`);
  await sharp(SAMPLE_IMAGE).jpeg({ quality: 92 }).toFile(capturePath);

  return { root, userDir, imageId, capturePath };
}

async function runDryPipeline(userDir, imageId) {
  const capturePath = path.join(getCapturesDir(userDir), `${imageId}.jpg`);
  const t0 = Date.now();

  const { subjectBuffer, editMask } = await segmentAndSaveArtifacts({
    userDir,
    imageId,
    sourcePath: capturePath,
  });

  const editedStandIn = await sharp(capturePath).jpeg({ quality: 92 }).toBuffer();
  const compositeSubjectBuffer = await buildCompositeSubjectFromEdited(
    editedStandIn,
    subjectBuffer
  );

  const meta = await sharp(compositeSubjectBuffer).metadata();
  const { buffer: bgBuffer, source } = await resolveAiThemeBackground({
    aiThemeId: "wild-west",
    width: meta.width ?? 1024,
    height: meta.height ?? 1536,
  });

  const processedDir = path.join(userDir, "processed", imageId);
  fs.mkdirSync(processedDir, { recursive: true });
  const subjectPath = path.join(processedDir, ".smoke-subject.png");
  const bgPath = path.join(processedDir, ".smoke-bg.png");
  const outPath = path.join(processedDir, ".smoke-out.png");

  await fs.promises.writeFile(subjectPath, compositeSubjectBuffer);
  await fs.promises.writeFile(bgPath, bgBuffer);

  await compositeSubject({
    subjectPath,
    outputPath: outPath,
    background: { type: "image", path: bgPath },
    harmonizeOptions: { harmonize: true, lookId: null },
  });

  const outStat = fs.statSync(outPath);
  console.log(
    `✓ dry hybrid segment+composite bg=${source} out=${Math.round(outStat.size / 1024)}KB mask=${editMask.length}B (${Date.now() - t0}ms)`
  );
}

async function run() {
  const { live } = parseArgs(process.argv);
  console.log(`\n🤠 AI hybrid pipeline smoke (${live ? "live" : "dry-run"})\n`);

  if (!isHybridPipelineAvailable()) {
    throw new Error(
      "Hybrid pipeline unavailable — check AI_PIPELINE_V2_ENABLED, segmentation assets, OPENAI_MASKED_EDIT_ENABLED"
    );
  }
  console.log("✓ hybrid pipeline available");

  const { root, userDir, imageId } = await createTempUserDir();

  try {
    if (!live) {
      await runDryPipeline(userDir, imageId);
      console.log("\n✅ AI hybrid pipeline smoke (dry-run) passed.\n");
      return;
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("OPENAI_API_KEY missing — required for --live");
    }

    const phases = [];
    const t0 = Date.now();
    const result = await runAiGeneration({
      userDir,
      imageId,
      themeId: "wild-west",
      onProgress: (phase) => phases.push(phase),
    });

    const stat = fs.statSync(result.outputPath);
    console.log(
      `✓ live hybrid pipeline=${result.pipeline} phases=[${phases.join(" → ")}] out=${Math.round(stat.size / 1024)}KB (${Date.now() - t0}ms)`
    );
    console.log("\n✅ AI hybrid pipeline smoke (live) passed.\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error("\n❌ AI hybrid pipeline smoke failed:", err.message);
  process.exit(1);
});
