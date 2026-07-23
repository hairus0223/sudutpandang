/**
 * Smoke test for face refine post-process (PR-F).
 *
 * Usage:
 *   npm run smoke-test:face-refine
 *   npm run smoke-test:face-refine -- --image path/to/photo.jpg
 */
import fs from "fs";
import path from "path";
import url from "url";
import sharp from "sharp";
import {
  getFaceRefineStatus,
  refineEditedFaceFromOriginal,
} from "../services/faceRefine.js";
import { buildFaceProtectMask } from "../services/personMask.js";
import { segmentPersonFromFile } from "../services/personSegmentation.js";

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

function faceRegionStats(originalRaw, editedRaw, refinedRaw, faceMaskRaw, channels = 3) {
  let facePixels = 0;
  let editDistance = 0;
  let refineDistance = 0;

  for (let i = 0; i < faceMaskRaw.length; i += 1) {
    if (faceMaskRaw[i] < 128) continue;

    facePixels += 1;
    const o = i * channels;
    const editDelta =
      Math.abs(editedRaw[o] - originalRaw[o]) +
      Math.abs(editedRaw[o + 1] - originalRaw[o + 1]) +
      Math.abs(editedRaw[o + 2] - originalRaw[o + 2]);
    const refineDelta =
      Math.abs(refinedRaw[o] - originalRaw[o]) +
      Math.abs(refinedRaw[o + 1] - originalRaw[o + 1]) +
      Math.abs(refinedRaw[o + 2] - originalRaw[o + 2]);

    editDistance += editDelta;
    refineDistance += refineDelta;
  }

  return {
    facePixels,
    editDistance: facePixels ? editDistance / facePixels : 0,
    refineDistance: facePixels ? refineDistance / facePixels : 0,
  };
}

async function run() {
  const { imagePath } = parseArgs(process.argv);
  const status = getFaceRefineStatus();
  console.log("\n🙂 Face refine smoke\n");
  console.log(
    `status: enabled=${status.enabled} available=${status.available} strength=${status.blendStrength} feather=${status.featherPx}px`
  );

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Sample image not found: ${imagePath}`);
  }

  const t0 = Date.now();
  const { subjectBuffer } = await segmentPersonFromFile(imagePath);

  const editedStandIn = await sharp(imagePath)
    .rotate()
    .recomb([
      [1.35, 0.12, 0.08],
      [0.1, 0.75, 0.1],
      [0.08, 0.12, 1.25],
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  const refined = await refineEditedFaceFromOriginal({
    originalPath: imagePath,
    editedBuffer: editedStandIn,
    subjectBuffer,
    strength: status.blendStrength,
    featherPx: status.featherPx,
  });

  const editMeta = await sharp(editedStandIn).metadata();
  const width = editMeta.width ?? 0;
  const height = editMeta.height ?? 0;

  const [originalRaw, editedRaw, refinedRaw, faceMaskRaw] = await Promise.all([
    sharp(imagePath, { failOn: "none", limitInputPixels: false })
      .rotate()
      .resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer(),
    sharp(editedStandIn).removeAlpha().raw().toBuffer(),
    sharp(refined).removeAlpha().raw().toBuffer(),
    buildFaceProtectMask(subjectBuffer).then((mask) =>
      sharp(mask).resize(width, height, { fit: "fill" }).greyscale().raw().toBuffer()
    ),
  ]);

  const stats = faceRegionStats(originalRaw, editedRaw, refinedRaw, faceMaskRaw);
  if (stats.facePixels < 100) {
    throw new Error(`Face mask too small (${stats.facePixels}px)`);
  }
  if (stats.refineDistance >= stats.editDistance * 0.6) {
    throw new Error(
      `Refined face not closer to original (edit=${stats.editDistance.toFixed(1)} refine=${stats.refineDistance.toFixed(1)})`
    );
  }

  console.log(
    `✓ face region px=${stats.facePixels} editΔ=${stats.editDistance.toFixed(1)} refineΔ=${stats.refineDistance.toFixed(1)} (${Date.now() - t0}ms)`
  );
  console.log("\n✅ Face refine smoke passed.\n");
}

run().catch((err) => {
  console.error("\n❌ Face refine smoke failed:", err.message);
  process.exit(1);
});
