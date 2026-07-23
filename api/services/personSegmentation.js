import fs from "fs";
import path from "path";
import {
  getBundledSegmentationModels,
  getSegmentationDistDir,
  getSegmentationModel,
  PERSON_SEGMENTATION_TIMEOUT_MS,
  segmentPersonFromBuffer,
  withSegmentationTimeout,
} from "./personSegmentationInference.js";
import {
  buildCostumeEditMask,
  buildSegmentAlphaMask,
} from "./personMask.js";
import {
  prepareSegmentationInput,
  postProcessSubjectBuffer,
} from "./personSegmentationPrepare.js";
import {
  getEditMaskPath,
  getProcessedDir,
  getSegmentMaskPath,
  getSubjectPath,
} from "./imageStorage.js";

export const PERSON_SEGMENTATION_ENABLED =
  process.env.PERSON_SEGMENTATION_ENABLED !== "false";

export const PERSON_SEGMENTATION_PREWARM =
  process.env.PERSON_SEGMENTATION_PREWARM === "true" ||
  (process.env.PERSON_SEGMENTATION_PREWARM !== "false" &&
    process.platform !== "win32");

const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export const PERSON_SEGMENTATION_USER_ERROR =
  "Segmentasi foto gagal. Silakan coba lagi atau hubungi staf.";

/**
 * @returns {{ assetsPath: string, assetsFound: boolean, model: string, bundledModels: string[] }}
 */
export function getPersonSegmentationAssetsStatus() {
  const assetsPath = getSegmentationDistDir();
  const bundledModels = getBundledSegmentationModels();
  const model = getSegmentationModel();

  return {
    assetsPath,
    assetsFound: fs.existsSync(assetsPath),
    model,
    bundledModels,
    requestedModel: (process.env.PERSON_SEGMENTATION_MODEL || "medium")
      .trim()
      .toLowerCase(),
  };
}

export function validatePersonSegmentationAssets() {
  if (!PERSON_SEGMENTATION_ENABLED) return;

  const status = getPersonSegmentationAssetsStatus();
  if (!status.assetsFound) {
    console.warn(
      `[person-segmentation] ONNX assets not found at ${status.assetsPath}. Run npm install in api/ and ensure @imgly/background-removal-node is present.`
    );
    return;
  }

  console.log(
    `[person-segmentation] assets OK model=${status.model} bundled=[${status.bundledModels.join(",")}] timeoutMs=${PERSON_SEGMENTATION_TIMEOUT_MS}`
  );
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function mapPersonSegmentationErrorToUserMessage(error) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown");

  if (message.includes("PERSON_SEGMENTATION_TIMEOUT")) {
    return "Segmentasi foto terlalu lama. Silakan coba lagi.";
  }

  const lower = message.toLowerCase();

  if (
    lower.includes("assets") ||
    lower.includes("wasm") ||
    lower.includes("onnx") ||
    lower.includes("publicpath") ||
    lower.includes("resource /models/")
  ) {
    return "Layanan segmentasi belum siap. Hubungi staf.";
  }

  if (lower.includes("enoent") || lower.includes("not found")) {
    return "File foto tidak ditemukan. Silakan ambil ulang foto.";
  }

  return PERSON_SEGMENTATION_USER_ERROR;
}

/**
 * @param {string} inputPath
 * @returns {Promise<{ subjectBuffer: Buffer, width: number, height: number }>}
 */
export async function segmentPersonFromFile(inputPath) {
  if (!PERSON_SEGMENTATION_ENABLED) {
    throw new Error("person_segmentation_disabled");
  }

  const prepared = await prepareSegmentationInput(inputPath);
  const rawSubject = await withSegmentationTimeout(
    segmentPersonFromBuffer(prepared.buffer, "image/png"),
    PERSON_SEGMENTATION_TIMEOUT_MS,
    "segment"
  );

  const subjectBuffer = await postProcessSubjectBuffer(
    rawSubject,
    prepared.targetWidth,
    prepared.targetHeight
  );

  return {
    subjectBuffer,
    width: prepared.targetWidth,
    height: prepared.targetHeight,
  };
}

/**
 * @param {Buffer} subjectBuffer
 */
export async function buildSegmentationMasks(subjectBuffer) {
  const [segmentMask, editMask] = await Promise.all([
    buildSegmentAlphaMask(subjectBuffer),
    buildCostumeEditMask(subjectBuffer),
  ]);

  return { segmentMask, editMask };
}

/**
 * Segment a portrait and write processed artifacts for the hybrid AI pipeline.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   sourcePath: string,
 * }} params
 */
export async function segmentAndSaveArtifacts({ userDir, imageId, sourcePath }) {
  const { subjectBuffer } = await segmentPersonFromFile(sourcePath);
  const { segmentMask, editMask } = await buildSegmentationMasks(subjectBuffer);

  const processedDir = getProcessedDir(userDir, imageId);
  fs.mkdirSync(processedDir, { recursive: true });

  const subjectPath = getSubjectPath(userDir, imageId);
  const segmentMaskPath = getSegmentMaskPath(userDir, imageId);
  const editMaskPath = getEditMaskPath(userDir, imageId);

  await fs.promises.writeFile(subjectPath, subjectBuffer);
  await fs.promises.writeFile(segmentMaskPath, segmentMask);
  await fs.promises.writeFile(editMaskPath, editMask);

  console.log(
    `[person-segmentation] ${imageId} → subject + masks (${path.basename(processedDir)})`
  );

  return {
    subjectPath,
    segmentMaskPath,
    editMaskPath,
    subjectBuffer,
    segmentMask,
    editMask,
  };
}

export function getPersonSegmentationStatus() {
  const assets = getPersonSegmentationAssetsStatus();

  if (!PERSON_SEGMENTATION_ENABLED) {
    return {
      ok: true,
      enabled: false,
      model: assets.model,
      assetsFound: assets.assetsFound,
      assetsPath: assets.assetsPath,
    };
  }

  return {
    ok: assets.assetsFound,
    enabled: true,
    model: assets.model,
    assetsFound: assets.assetsFound,
    assetsPath: assets.assetsPath,
    timeoutMs: PERSON_SEGMENTATION_TIMEOUT_MS,
  };
}

/**
 * @returns {Promise<{ success: boolean, durationMs: number, error?: string }>}
 */
export async function prewarmPersonSegmentation() {
  if (!PERSON_SEGMENTATION_ENABLED || !PERSON_SEGMENTATION_PREWARM) {
    return { success: false, durationMs: 0, error: "prewarm_skipped" };
  }

  const status = getPersonSegmentationAssetsStatus();
  if (!status.assetsFound) {
    return { success: false, durationMs: 0, error: "assets_missing" };
  }

  const startedAt = Date.now();
  try {
    await withSegmentationTimeout(
      segmentPersonFromBuffer(TINY_PNG_BUFFER, "image/png"),
      PERSON_SEGMENTATION_TIMEOUT_MS,
      "prewarm"
    );
    const durationMs = Date.now() - startedAt;
    console.log(`[person-segmentation] pre-warm OK ${durationMs}ms`);
    return { success: true, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[person-segmentation] pre-warm failed (${durationMs}ms):`, message);
    return { success: false, durationMs, error: message };
  }
}
