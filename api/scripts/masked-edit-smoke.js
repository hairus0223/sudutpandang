/**
 * Smoke test for masked OpenAI edits (segment → mask → edit API).
 *
 * Usage:
 *   npm run smoke-test:masked-edit          # dry-run (no OpenAI call)
 *   npm run smoke-test:masked-edit -- --live  # calls OpenAI (costs credits)
 *   node scripts/masked-edit-smoke.js --image path/to/photo.jpg --live
 */
import fs from "fs";
import path from "path";
import url from "url";
import {
  generateTransformedImage,
  OPENAI_MASKED_EDIT_ENABLED,
  prepareSourceImageForOpenAi,
} from "../services/openaiImage.js";
import { normalizeMaskForOpenAiEdit } from "../services/personMask.js";
import {
  buildSegmentationMasks,
  segmentPersonFromFile,
} from "../services/personSegmentation.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DEFAULT_IMAGE = path.join(
  __dirname,
  "..",
  "assets",
  "ai-theme-previews",
  "wild-west",
  "before.png"
);

function parseArgs(argv) {
  /** @type {{ imagePath: string, live: boolean }} */
  const args = { imagePath: DEFAULT_IMAGE, live: false };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--image" && argv[i + 1]) {
      args.imagePath = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--live") {
      args.live = true;
    }
  }

  return args;
}

async function run() {
  const { imagePath, live } = parseArgs(process.argv);
  console.log(`\n🎭 Masked OpenAI edit smoke (${live ? "live" : "dry-run"})\n`);

  if (!OPENAI_MASKED_EDIT_ENABLED) {
    throw new Error("OPENAI_MASKED_EDIT_ENABLED=false — enable masked edit to run smoke");
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error(`image not found: ${imagePath}`);
  }

  const t0 = Date.now();
  const { subjectBuffer } = await segmentPersonFromFile(imagePath);
  const { editMask } = await buildSegmentationMasks(subjectBuffer);
  const prepared = await prepareSourceImageForOpenAi(imagePath);
  const openAiMask = await normalizeMaskForOpenAiEdit(
    editMask,
    prepared.width,
    prepared.height
  );

  console.log(
    `✓ segment + mask ${prepared.width}x${prepared.height} mask=${openAiMask.length}B (${Date.now() - t0}ms)`
  );

  if (!live) {
    console.log("✓ dry-run OK — pass --live to call OpenAI");
    console.log("\n✅ Masked edit smoke (dry-run) passed.\n");
    return;
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY missing — required for --live");
  }

  const prompt =
    "Replace clothing only with authentic 19th-century cowboy attire. Do not change face or background.";
  const negativePrompt = "different person, changed pose, face swap, cartoon, low quality";

  const t1 = Date.now();
  const result = await generateTransformedImage({
    imagePath,
    prompt,
    negativePrompt,
    width: prepared.width,
    height: prepared.height,
    tier: "research",
    maskBuffer: editMask,
  });

  console.log(
    `✓ OpenAI masked edit result=${result.length}B (${Date.now() - t1}ms, total ${Date.now() - t0}ms)`
  );
  console.log("\n✅ Masked edit smoke (live) passed.\n");
}

run().catch((err) => {
  console.error("\n❌ Masked edit smoke failed:", err.message);
  process.exit(1);
});
