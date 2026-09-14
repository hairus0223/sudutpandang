/**
 * Smoke test for Pro Booth composite-costume pipeline (PR-3) + Phase 1 production gates.
 *
 * Usage:
 *   npm run smoke-test:ai-booth-costume          # dry — gates + composite-only
 *   npm run smoke-test:ai-booth-costume -- --live # full costume pass (OpenAI billed)
 */
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { getAiTheme } from "../services/aiThemes.js";
import {
  AI_PIPELINE_FALLBACK_DIRECT,
  isCostumePassAvailable,
  mapCompositeBoothErrorToUserMessage,
  resolveEffectivePipeline,
  runCompositeBoothGeneration,
  runCompositeCostumeBoothGeneration,
} from "../services/aiProBooth.js";
import { getAiPipelineStatus, mapAiGenerationErrorToUserMessage } from "../services/aiGeneration.js";
import {
  assertIdentityLock,
  assertSubjectMatte,
  bboxIou,
} from "../services/aiIdentityLock.js";

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

async function createSubjectPng(outPath) {
  const svg = `<svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="400" cy="340" rx="120" ry="150" fill="#fde68a"/>
    <rect x="280" y="500" width="240" height="420" rx="40" fill="#3b82f6"/>
    <rect x="320" y="920" width="70" height="220" fill="#1e293b"/>
    <rect x="410" y="920" width="70" height="220" fill="#1e293b"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runPhase1Guards() {
  console.log("Phase 1 guards");

  const status = getAiPipelineStatus();
  if (AI_PIPELINE_FALLBACK_DIRECT || status.fallbackDirect) {
    console.warn(
      "  ⚠ AI_PIPELINE_FALLBACK_DIRECT=true in env — production should set false"
    );
  }
  if (status.pipeline === "direct") {
    throw new Error(`production pipeline must not be direct (got ${status.pipeline})`);
  }
  if (status.faceRefine && status.faceRefine.enabled === false) {
    console.warn("  ⚠ FACE_REFINE_ENABLED=false in env — costume jobs will fail identity lock");
  }

  let threwDirect = false;
  try {
    resolveEffectivePipeline(
      { id: "wild-west", pipelineMode: "direct" },
      { allowDirect: false }
    );
  } catch (err) {
    threwDirect = err instanceof Error && err.message === "direct_pipeline_disabled";
  }
  assert(threwDirect, "direct theme must throw without allowDirect");

  let threwComposite = false;
  try {
    resolveEffectivePipeline(
      { id: "wild-west", pipelineMode: "composite-costume" },
      {
        allowDirect: false,
        fallbackDirect: false,
        costumeAvailable: false,
        compositeAvailable: false,
      }
    );
  } catch (err) {
    threwComposite = err instanceof Error && err.message === "composite_pipeline_unavailable";
  }
  assert(threwComposite, "missing composite must not fall back to direct");

  const fallbackOnly = resolveEffectivePipeline(
    { id: "wild-west", pipelineMode: "composite-costume" },
    { costumeAvailable: false, compositeAvailable: true }
  );
  assert(fallbackOnly === "composite-only", "costume down must fall back to composite-only");

  assert(
    mapCompositeBoothErrorToUserMessage(new Error("identity_mismatch")) ===
      "Hasil tidak menjaga wajah asli. Tidak disimpan. Coba foto lain.",
    "identity error copy"
  );
  assert(
    mapAiGenerationErrorToUserMessage(new Error("composite_pipeline_unavailable")).includes(
      "Layanan edit AI belum siap"
    ),
    "unavailable copy"
  );

  assert(bboxIou({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { minX: 0, minY: 0, maxX: 10, maxY: 10 }) === 1);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp-ai-identity-"));
  const originalPath = path.join(root, "orig.jpg");
  const subjectPath = path.join(root, "subject.png");
  await createSamplePortrait(originalPath);
  await createSubjectPng(subjectPath);
  const subjectBuffer = fs.readFileSync(subjectPath);
  await assertSubjectMatte(subjectBuffer);

  const sameBuffer = fs.readFileSync(originalPath);
  await assertIdentityLock({
    originalPath,
    editedBuffer: sameBuffer,
    subjectBuffer,
  });

  const shiftedSvg = `<svg width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="1200" fill="#cbd5e1"/>
    <ellipse cx="140" cy="900" rx="120" ry="150" fill="#fde68a"/>
  </svg>`;
  const shiftedBuffer = await sharp(Buffer.from(shiftedSvg)).jpeg({ quality: 90 }).toBuffer();
  let identityFailed = false;
  try {
    await assertIdentityLock({
      originalPath,
      editedBuffer: shiftedBuffer,
      subjectBuffer,
    });
  } catch (err) {
    identityFailed = err instanceof Error && err.message === "identity_mismatch";
  }
  assert(identityFailed, "shifted face must fail identity lock");

  console.log("  ✓ pipeline gates + identity lock");
}

async function main() {
  const live = process.argv.includes("--live");
  console.log(`\n🎭 AI booth costume smoke${live ? " (live OpenAI)" : ""}\n`);

  await runPhase1Guards();

  const status = getAiPipelineStatus();
  console.log(
    `pipeline=${status.pipeline} costume=${status.costumePassAvailable} maskedEdit=${status.maskedEditEnabled} faceRefine=${status.faceRefine?.enabled}`
  );

  const theme = getAiTheme("wild-west");
  if (!theme) throw new Error("wild-west theme missing");

  const effective = resolveEffectivePipeline(theme);
  console.log(`effectivePipeline=${effective}`);
  if (effective === "direct") {
    throw new Error("effective pipeline must not be direct");
  }

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
