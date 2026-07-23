/**
 * Smoke test for person segmentation (ONNX / imgly).
 *
 * Usage:
 *   npm run smoke-test:person-segmentation
 *   node scripts/person-segmentation-smoke.js --image path/to/photo.jpg
 */
import fs from "fs";
import path from "path";
import url from "url";
import {
  getPersonSegmentationAssetsStatus,
  segmentPersonFromFile,
  buildSegmentationMasks,
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
  /** @type {{ imagePath: string }} */
  const args = { imagePath: DEFAULT_IMAGE };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--image" && argv[i + 1]) {
      args.imagePath = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

async function run() {
  const { imagePath } = parseArgs(process.argv);
  console.log(`\n🧍 Person segmentation smoke\n`);

  const assets = getPersonSegmentationAssetsStatus();
  if (!assets.assetsFound) {
    throw new Error(
      `ONNX assets missing at ${assets.assetsPath} — run npm install in api/`
    );
  }
  console.log(`✓ assets model=${assets.model}`);

  if (!fs.existsSync(imagePath)) {
    throw new Error(`image not found: ${imagePath}`);
  }

  const t0 = Date.now();
  const { subjectBuffer, width, height } = await segmentPersonFromFile(imagePath);
  const segmentMs = Date.now() - t0;

  const { segmentMask, editMask } = await buildSegmentationMasks(subjectBuffer);
  const totalMs = Date.now() - t0;

  console.log(`✓ segment ${width}x${height} subject=${subjectBuffer.length}B (${segmentMs}ms)`);
  console.log(
    `✓ masks segment=${segmentMask.length}B edit=${editMask.length}B (total ${totalMs}ms)`
  );
  console.log("\n✅ Person segmentation smoke passed.\n");
}

run().catch((err) => {
  console.error("\n❌ Person segmentation smoke failed:", err.message);
  process.exit(1);
});
