import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  getThemeTransformPrompt,
  getAiTheme,
  normalizeAiThemeId,
} from "./aiThemes.js";
import {
  mapOpenAiErrorToUserMessage,
  generateTransformedImage,
  OPENAI_MASKED_EDIT_ENABLED,
} from "./openaiImage.js";
import { resolveAiThemeBackground } from "./aiThemeBackgrounds.js";
import { compositeSubject } from "./imageComposite.js";
import {
  isFaceRefineAvailable,
  refineEditedFaceFromOriginal,
  getFaceRefineStatus,
} from "./faceRefine.js";
import { buildCompositeSubjectFromEdited } from "./personMask.js";
import {
  mapPersonSegmentationErrorToUserMessage,
  getPersonSegmentationStatus,
  segmentAndSaveArtifacts,
  PERSON_SEGMENTATION_ENABLED,
} from "./personSegmentation.js";
import {
  findOriginalPath,
  getAiThemedPath,
  getAiThemedRelativePath,
  getProcessedDir,
  updateAiVariantInMeta,
} from "./imageStorage.js";
import { getAiGenerationConfig, isAiGenerationEnabled } from "./packageTypes.js";
import { resolveBaseDir } from "./studioPaths.js";

export const AI_PIPELINE_V2_ENABLED = process.env.AI_PIPELINE_V2_ENABLED !== "false";

/**
 * @param {unknown} error
 * @returns {string}
 */
export function mapAiGenerationErrorToUserMessage(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message === "original_not_found") {
    return "File foto tidak ditemukan. Silakan ambil ulang foto.";
  }
  if (message === "invalid_theme") {
    return "Tema tidak valid.";
  }
  if (message === "ai_disabled") {
    return "Generate AI belum aktif. Hubungi staf.";
  }
  if (message === "edit_mask_not_found" || message === "edit_mask_invalid") {
    return mapOpenAiErrorToUserMessage(message);
  }
  if (
    message === "person_segmentation_disabled" ||
    message.startsWith("PERSON_SEGMENTATION_TIMEOUT") ||
    message === "invalid_subject_dimensions"
  ) {
    return mapPersonSegmentationErrorToUserMessage(
      error instanceof Error ? error : new Error(message)
    );
  }
  if (message.startsWith("timeout:")) {
    return "Generate AI terlalu lama. Coba lagi.";
  }

  if (
    message.startsWith("openai_") ||
    message.startsWith("openai_error:")
  ) {
    return mapOpenAiErrorToUserMessage(message);
  }

  return "Generate AI gagal. Coba lagi atau hubungi staf.";
}

/**
 * @returns {boolean}
 */
export function isHybridPipelineAvailable() {
  if (!AI_PIPELINE_V2_ENABLED) return false;
  if (!OPENAI_MASKED_EDIT_ENABLED) return false;
  if (!PERSON_SEGMENTATION_ENABLED) return false;
  return getPersonSegmentationStatus().assetsFound;
}

/**
 * @param {string} userDir
 * @param {string} imageId
 */
async function resolveOriginalDimensions(userDir, imageId) {
  const originalPath = findOriginalPath(userDir, imageId);
  if (!originalPath) {
    throw new Error("original_not_found");
  }

  const meta = await sharp(originalPath).metadata();
  return {
    originalPath,
    width: meta.width || 1024,
    height: meta.height || 1536,
  };
}

/**
 * @param {string} processedDir
 * @param {string} prefix
 */
async function removeTempFiles(processedDir, prefix) {
  if (!fs.existsSync(processedDir)) return;

  const entries = await fs.promises.readdir(processedDir);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => fs.promises.unlink(path.join(processedDir, name)).catch(() => {}))
  );
}

/**
 * Hybrid v2: segment → masked costume edit → composite Western background.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   theme: import("./aiThemes.js").AiTheme,
 *   onProgress?: (phase: string) => void,
 *   jobId?: string,
 *   user?: string,
 * }} params
 */
async function runHybridGeneration({ userDir, imageId, theme, onProgress, jobId, user }) {
  const { originalPath, width, height } = await resolveOriginalDimensions(
    userDir,
    imageId
  );
  const processedDir = getProcessedDir(userDir, imageId);
  fs.mkdirSync(processedDir, { recursive: true });

  onProgress?.("segmenting");
  const { subjectBuffer, editMask } = await segmentAndSaveArtifacts({
    userDir,
    imageId,
    sourcePath: originalPath,
  });

  onProgress?.("generating");
  let editedBuffer = await generateTransformedImage({
    imagePath: originalPath,
    prompt: getThemeTransformPrompt(theme),
    negativePrompt: theme.negativePrompt,
    width,
    height,
    tier: "production",
    maskBuffer: editMask,
    billing: {
      baseDir: resolveBaseDir(),
      source: "gallery",
      themeId: theme.id,
      imageId,
      jobId,
      user,
    },
  });

  if (isFaceRefineAvailable()) {
    onProgress?.("refining");
    editedBuffer = await refineEditedFaceFromOriginal({
      originalPath,
      editedBuffer,
      subjectBuffer,
    });
  }

  onProgress?.("compositing");
  const compositeSubjectBuffer = await buildCompositeSubjectFromEdited(
    editedBuffer,
    subjectBuffer
  );

  const subjectMeta = await sharp(compositeSubjectBuffer).metadata();
  const compositeWidth = subjectMeta.width ?? width;
  const compositeHeight = subjectMeta.height ?? height;

  const { buffer: backgroundBuffer, source: bgSource } = await resolveAiThemeBackground({
    aiThemeId: theme.id,
    width: compositeWidth,
    height: compositeHeight,
    baseDir: resolveBaseDir(),
  });

  const stamp = Date.now();
  const tempSubjectPath = path.join(processedDir, `.ai-subject-${stamp}.png`);
  const tempBgPath = path.join(processedDir, `.ai-bg-${theme.id}-${stamp}.png`);
  const tempCompositePath = path.join(processedDir, `.ai-composite-${stamp}.png`);

  await fs.promises.writeFile(tempSubjectPath, compositeSubjectBuffer);
  await fs.promises.writeFile(tempBgPath, backgroundBuffer);

  try {
    await compositeSubject({
      subjectPath: tempSubjectPath,
      outputPath: tempCompositePath,
      background: { type: "image", path: tempBgPath },
      harmonizeOptions: { harmonize: true, lookId: null },
    });
  } finally {
    await Promise.all([
      fs.promises.unlink(tempSubjectPath).catch(() => {}),
      fs.promises.unlink(tempBgPath).catch(() => {}),
    ]);
  }

  onProgress?.("finishing");
  const outputPath = getAiThemedPath(userDir, imageId, theme.id);
  await sharp(tempCompositePath)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outputPath);

  await fs.promises.unlink(tempCompositePath).catch(() => {});
  await removeTempFiles(processedDir, `.ai-subject-`);
  await removeTempFiles(processedDir, `.ai-bg-`);
  await removeTempFiles(processedDir, `.ai-composite-`);

  const relativePath = getAiThemedRelativePath(imageId, theme.id);
  updateAiVariantInMeta(userDir, imageId, theme.id, relativePath);

  console.log(
    `[ai-gen] hybrid ${imageId} theme=${theme.id} bg=${bgSource} → ${path.basename(outputPath)}`
  );

  return { outputPath, relativePath, pipeline: "hybrid-v2" };
}

/**
 * Legacy v1: one-shot OpenAI edit (full frame).
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   theme: import("./aiThemes.js").AiTheme,
 *   onProgress?: (phase: string) => void,
 *   jobId?: string,
 *   user?: string,
 * }} params
 */
async function runLegacyGeneration({ userDir, imageId, theme, onProgress, jobId, user }) {
  const { originalPath, width, height } = await resolveOriginalDimensions(
    userDir,
    imageId
  );

  onProgress?.("generating");
  const transformedBuffer = await generateTransformedImage({
    imagePath: originalPath,
    prompt: getThemeTransformPrompt(theme),
    negativePrompt: theme.negativePrompt,
    width,
    height,
    tier: "production",
    billing: {
      baseDir: resolveBaseDir(),
      source: "gallery",
      themeId: theme.id,
      imageId,
      jobId,
      user,
    },
  });

  onProgress?.("finishing");
  const processedDir = getProcessedDir(userDir, imageId);
  fs.mkdirSync(processedDir, { recursive: true });

  const outputPath = getAiThemedPath(userDir, imageId, theme.id);
  await sharp(transformedBuffer).jpeg({ quality: 92, mozjpeg: true }).toFile(outputPath);

  const relativePath = getAiThemedRelativePath(imageId, theme.id);
  updateAiVariantInMeta(userDir, imageId, theme.id, relativePath);

  console.log(
    `[ai-gen] legacy ${imageId} theme=${theme.id} → ${path.basename(outputPath)}`
  );

  return { outputPath, relativePath, pipeline: "legacy-v1" };
}

/** @returns {string} */
export function getAiGenerationInitialPhase() {
  return isHybridPipelineAvailable() ? "segmenting" : "generating";
}

/**
 * Run the full AI self-photo pipeline for one image + theme.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   themeId: string,
 *   onProgress?: (phase: string) => void,
 *   jobId?: string,
 *   user?: string,
 * }} params
 */
export async function runAiGeneration({ userDir, imageId, themeId, onProgress, jobId, user }) {
  if (!isAiGenerationEnabled()) {
    throw new Error("ai_disabled");
  }

  const theme = getAiTheme(normalizeAiThemeId(themeId));
  if (!theme) {
    throw new Error("invalid_theme");
  }

  if (isHybridPipelineAvailable()) {
    return runHybridGeneration({ userDir, imageId, theme, onProgress, jobId, user });
  }

  return runLegacyGeneration({ userDir, imageId, theme, onProgress, jobId, user });
}

export function getAiPipelineStatus() {
  const hybridAvailable = isHybridPipelineAvailable();

  return {
    ...getAiGenerationConfig(),
    pipeline: hybridAvailable ? "hybrid-v2" : "legacy-v1",
    pipelineV2Enabled: AI_PIPELINE_V2_ENABLED,
    maskedEditEnabled: OPENAI_MASKED_EDIT_ENABLED,
    faceRefine: getFaceRefineStatus(),
    personSegmentation: getPersonSegmentationStatus(),
  };
}
