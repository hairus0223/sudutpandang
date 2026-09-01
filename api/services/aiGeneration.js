import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getThemeTransformPrompt, getAiTheme, normalizeAiThemeId } from "./aiThemes.js";
import {
  mapOpenAiErrorToUserMessage,
  generateTransformedImage,
} from "./openaiImage.js";
import {
  findOriginalPath,
  getAiThemedPath,
  getAiThemedRelativePath,
  getProcessedDir,
  updateAiVariantInMeta,
} from "./imageStorage.js";
import { getAiGenerationConfig, isAiGenerationEnabled } from "./packageTypes.js";
import { resolveBaseDir } from "./studioPaths.js";
import {
  getInitialPhaseForTheme,
  isCompositeBoothAvailable,
  isCostumePassAvailable,
  mapCompositeBoothErrorToUserMessage,
  resolveEffectivePipeline,
  runCompositeBoothGeneration,
  runCompositeCostumeBoothGeneration,
} from "./aiProBooth.js";
import { getPersonSegmentationStatus } from "./personSegmentation.js";
import { OPENAI_MASKED_EDIT_ENABLED } from "./openaiImage.js";
import { getFaceRefineStatus } from "./faceRefine.js";
import {
  THEME_PROP_OVERLAYS_ENABLED,
  validateBundledThemeOverlays,
} from "./aiThemeOverlays.js";

/**
 * @param {unknown} error
 * @returns {string}
 */
export function mapAiGenerationErrorToUserMessage(error) {
  const compositeMessage = mapCompositeBoothErrorToUserMessage(error);
  if (compositeMessage) return compositeMessage;

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

/** @returns {string} */
export function getAiGenerationInitialPhase() {
  if (!isCompositeBoothAvailable()) return "generating";
  return "segmenting";
}

/**
 * Direct OpenAI transform: generating → finishing.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   theme: import("./aiThemes.js").AiTheme,
 *   onProgress?: (phase: string) => void,
 *   jobId?: string,
 *   user?: string,
 * }} params
 */
async function runDirectGeneration({ userDir, imageId, theme, onProgress, jobId, user }) {
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
    `[ai-gen] direct ${imageId} theme=${theme.id} → ${path.basename(outputPath)}`
  );

  return { outputPath, relativePath, pipeline: "direct" };
}

/**
 * Pro booth composite-only: segmenting → compositing → finishing.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   theme: import("./aiThemes.js").AiTheme,
 *   onProgress?: (phase: string) => void,
 * }} params
 */
async function runCompositeGeneration({ userDir, imageId, theme, onProgress }) {
  const { originalPath } = await resolveOriginalDimensions(userDir, imageId);
  const outputPath = getAiThemedPath(userDir, imageId, theme.id);

  const { bgSource } = await runCompositeBoothGeneration({
    sourcePath: originalPath,
    theme,
    outputPath,
    baseDir: resolveBaseDir(),
    onProgress,
    artifacts: { userDir, imageId },
  });

  const relativePath = getAiThemedRelativePath(imageId, theme.id);
  updateAiVariantInMeta(userDir, imageId, theme.id, relativePath);

  console.log(
    `[ai-gen] composite ${imageId} theme=${theme.id} bg=${bgSource} → ${path.basename(outputPath)}`
  );

  return { outputPath, relativePath, pipeline: "composite-only" };
}

/**
 * Pro booth composite-costume: segmenting → generating → refining → compositing → finishing.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   theme: import("./aiThemes.js").AiTheme,
 *   onProgress?: (phase: string) => void,
 *   jobId?: string,
 *   user?: string,
 * }} params
 */
async function runCompositeCostumeGeneration({
  userDir,
  imageId,
  theme,
  onProgress,
  jobId,
  user,
}) {
  const { originalPath } = await resolveOriginalDimensions(userDir, imageId);
  const outputPath = getAiThemedPath(userDir, imageId, theme.id);

  const { bgSource, faceRefined } = await runCompositeCostumeBoothGeneration({
    sourcePath: originalPath,
    theme,
    outputPath,
    baseDir: resolveBaseDir(),
    onProgress,
    artifacts: { userDir, imageId },
    billing: {
      baseDir: resolveBaseDir(),
      source: "gallery",
      themeId: theme.id,
      imageId,
      jobId,
      user,
    },
  });

  const relativePath = getAiThemedRelativePath(imageId, theme.id);
  updateAiVariantInMeta(userDir, imageId, theme.id, relativePath);

  console.log(
    `[ai-gen] composite-costume ${imageId} theme=${theme.id} bg=${bgSource} faceRefined=${faceRefined} → ${path.basename(outputPath)}`
  );

  return { outputPath, relativePath, pipeline: "composite-costume" };
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

  const pipeline = resolveEffectivePipeline(theme);

  if (pipeline === "composite-costume") {
    return runCompositeCostumeGeneration({
      userDir,
      imageId,
      theme,
      onProgress,
      jobId,
      user,
    });
  }

  if (pipeline === "composite-only") {
    return runCompositeGeneration({ userDir, imageId, theme, onProgress });
  }

  return runDirectGeneration({ userDir, imageId, theme, onProgress, jobId, user });
}

export function getAiPipelineStatus() {
  const compositeAvailable = isCompositeBoothAvailable();
  const costumeAvailable = isCostumePassAvailable();
  const defaultMode =
    process.env.AI_DEFAULT_PIPELINE_MODE || "composite-costume";

  let pipeline = "direct";
  if (costumeAvailable && defaultMode === "composite-costume") {
    pipeline = "composite-costume";
  } else if (compositeAvailable) {
    pipeline = "composite-only";
  }

  const overlayReport = validateBundledThemeOverlays();

  return {
    ...getAiGenerationConfig(),
    pipeline,
    compositeBoothAvailable: compositeAvailable,
    costumePassAvailable: costumeAvailable,
    maskedEditEnabled: OPENAI_MASKED_EDIT_ENABLED,
    faceRefine: getFaceRefineStatus(),
    personSegmentation: getPersonSegmentationStatus(),
    defaultPipelineMode: defaultMode,
    fallbackDirect: process.env.AI_PIPELINE_FALLBACK_DIRECT !== "false",
    propOverlays: {
      enabled: THEME_PROP_OVERLAYS_ENABLED,
      bundledReady: overlayReport.ok,
      missing: overlayReport.missing,
    },
  };
}

/** @param {import("./aiThemeCatalog.js").AiTheme} theme */
export function getAiGenerationInitialPhaseForTheme(theme) {
  return getInitialPhaseForTheme(theme);
}
