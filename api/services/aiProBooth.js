import fs from "fs";
import path from "path";
import sharp from "sharp";
import { resolveAiThemeBackground } from "./aiThemeBackgrounds.js";
import {
  applyThemePropOverlays,
  listThemeOverlayPaths,
  THEME_PROP_OVERLAYS_ENABLED,
} from "./aiThemeOverlays.js";
import { writePlacedSubjectFile } from "./aiThemePlacement.js";
import { compositeSubject } from "./imageComposite.js";
import { normalizeLookId } from "./lookPresets.js";
import {
  getThemeCostumeNegativePrompt,
  getThemeCostumePrompt,
  getThemePipelineMode,
  isCompositePipelineMode,
} from "./aiThemeCatalog.js";
import {
  getPersonSegmentationStatus,
  mapPersonSegmentationErrorToUserMessage,
  PERSON_SEGMENTATION_ENABLED,
  segmentAndSaveArtifacts,
  segmentPersonFromFile,
  buildSegmentationMasks,
} from "./personSegmentation.js";
import { buildCompositeSubjectFromEdited } from "./personMask.js";
import { getEditMaskPath, getSubjectPath } from "./imageStorage.js";
import {
  generateTransformedImage,
  OPENAI_MASKED_EDIT_ENABLED,
} from "./openaiImage.js";
import {
  FACE_REFINE_ENABLED,
  isFaceRefineAvailable,
  refineEditedFaceFromOriginal,
} from "./faceRefine.js";

export const AI_PIPELINE_FALLBACK_DIRECT =
  process.env.AI_PIPELINE_FALLBACK_DIRECT !== "false";

/**
 * @returns {boolean}
 */
export function isCompositeBoothAvailable() {
  if (!PERSON_SEGMENTATION_ENABLED) return false;
  return getPersonSegmentationStatus().assetsFound;
}

/**
 * @returns {boolean}
 */
export function isCostumePassAvailable() {
  if (!isCompositeBoothAvailable()) return false;
  if (!OPENAI_MASKED_EDIT_ENABLED) return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @returns {"direct" | "composite-only" | "composite-costume"}
 */
export function resolveEffectivePipeline(theme) {
  const configured = getThemePipelineMode(theme);

  if (!isCompositePipelineMode(configured)) {
    return "direct";
  }

  if (configured === "composite-costume" && isCostumePassAvailable()) {
    return "composite-costume";
  }

  if (isCompositeBoothAvailable()) {
    if (configured === "composite-costume") {
      console.warn(
        `[ai-booth] costume pass unavailable for theme=${theme.id} — falling back to composite-only`
      );
    }
    return "composite-only";
  }

  if (AI_PIPELINE_FALLBACK_DIRECT) {
    console.warn(
      `[ai-booth] composite unavailable for theme=${theme.id} — falling back to direct OpenAI`
    );
    return "direct";
  }

  throw new Error("composite_pipeline_unavailable");
}

/**
 * @param {import("./aiThemeCatalog.js").AiTheme} theme
 * @returns {string}
 */
export function getInitialPhaseForTheme(theme) {
  const pipeline = resolveEffectivePipeline(theme);
  return pipeline === "direct" ? "generating" : "segmenting";
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
 * @param {{
 *   subjectPath: string,
 *   theme: import("./aiThemeCatalog.js").AiTheme,
 *   outputPath: string,
 *   baseDir: string,
 *   width: number,
 *   height: number,
 *   cleanupSubjectPath?: boolean,
 * }} params
 */
async function compositeSubjectOntoThemeBackground({
  subjectPath,
  theme,
  outputPath,
  baseDir,
  width,
  height,
  cleanupSubjectPath = false,
}) {
  const requirePhoto = theme.backgroundRequired !== false;
  const { buffer: backgroundBuffer, source: bgSource } = await resolveAiThemeBackground({
    aiThemeId: theme.id,
    width,
    height,
    baseDir,
    requirePhoto,
  });

  const lookId = theme.lookId ? normalizeLookId(theme.lookId, "ai-photo") : null;
  const processedDir = path.dirname(outputPath);
  const stamp = Date.now();
  const tempBgPath = path.join(processedDir, `.booth-bg-${theme.id}-${stamp}.png`);
  const tempCompositePath = path.join(processedDir, `.booth-composite-${stamp}.png`);
  const tempPlacedSubjectPath = path.join(
    processedDir,
    `.booth-placed-subject-${stamp}.png`
  );

  await fs.promises.writeFile(tempBgPath, backgroundBuffer);

  try {
    await writePlacedSubjectFile(
      subjectPath,
      width,
      height,
      theme.placement,
      tempPlacedSubjectPath
    );

    await compositeSubject({
      subjectPath: tempPlacedSubjectPath,
      outputPath: tempCompositePath,
      background: { type: "image", path: tempBgPath },
      harmonizeOptions: { harmonize: true, lookId },
    });
  } finally {
    await Promise.all([
      fs.promises.unlink(tempBgPath).catch(() => {}),
      fs.promises.unlink(tempPlacedSubjectPath).catch(() => {}),
      cleanupSubjectPath
        ? fs.promises.unlink(subjectPath).catch(() => {})
        : Promise.resolve(),
    ]);
  }

  const withOverlays = await applyThemePropOverlays(
    tempCompositePath,
    theme,
    width,
    height,
    baseDir
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(withOverlays).jpeg({ quality: 92, mozjpeg: true }).toFile(outputPath);

  await fs.promises.unlink(tempCompositePath).catch(() => {});
  await removeTempFiles(processedDir, `.booth-bg-`);
  await removeTempFiles(processedDir, `.booth-composite-`);

  const overlayPaths = listThemeOverlayPaths(theme, baseDir);
  const overlaysApplied =
    THEME_PROP_OVERLAYS_ENABLED && overlayPaths.length > 0;

  return { bgSource, overlaysApplied };
}

/**
 * Segment + composite subject onto theme photo background.
 * @param {{
 *   sourcePath: string,
 *   theme: import("./aiThemeCatalog.js").AiTheme,
 *   outputPath: string,
 *   baseDir: string,
 *   onProgress?: (phase: string) => void,
 *   artifacts?: { userDir: string, imageId: string } | null,
 * }} params
 */
export async function runCompositeBoothGeneration({
  sourcePath,
  theme,
  outputPath,
  baseDir,
  onProgress,
  artifacts = null,
}) {
  onProgress?.("segmenting");

  let subjectPath;
  let width;
  let height;

  if (artifacts?.userDir && artifacts?.imageId) {
    await segmentAndSaveArtifacts({
      userDir: artifacts.userDir,
      imageId: artifacts.imageId,
      sourcePath,
    });
    subjectPath = getSubjectPath(artifacts.userDir, artifacts.imageId);
    const meta = await sharp(subjectPath).metadata();
    width = meta.width || 1024;
    height = meta.height || 1536;
  } else {
    const segmented = await segmentPersonFromFile(sourcePath);
    width = segmented.width;
    height = segmented.height;

    const tmpDir = path.dirname(outputPath);
    fs.mkdirSync(tmpDir, { recursive: true });
    subjectPath = path.join(tmpDir, `.booth-subject-${Date.now()}.png`);
    await fs.promises.writeFile(subjectPath, segmented.subjectBuffer);
  }

  onProgress?.("compositing");

  const { bgSource, overlaysApplied } = await compositeSubjectOntoThemeBackground({
    subjectPath,
    theme,
    outputPath,
    baseDir,
    width,
    height,
    cleanupSubjectPath: !artifacts,
  });

  onProgress?.("finishing");

  return { pipeline: "composite-only", bgSource, overlaysApplied };
}

/**
 * Segment → masked costume edit → face refine → composite onto theme background.
 * @param {{
 *   sourcePath: string,
 *   theme: import("./aiThemeCatalog.js").AiTheme,
 *   outputPath: string,
 *   baseDir: string,
 *   onProgress?: (phase: string) => void,
 *   artifacts?: { userDir: string, imageId: string } | null,
 *   billing?: {
 *     baseDir: string,
 *     source: string,
 *     themeId?: string,
 *     imageId?: string,
 *     jobId?: string,
 *     user?: string,
 *     runId?: string,
 *     draftId?: string,
 *   } | null,
 *   imageQuality?: string,
 *   imageInputFidelity?: string,
 *   tier?: import("./packageTypes.js").OpenAiImageTier,
 * }} params
 */
export async function runCompositeCostumeBoothGeneration({
  sourcePath,
  theme,
  outputPath,
  baseDir,
  onProgress,
  artifacts = null,
  billing = null,
  imageQuality,
  imageInputFidelity,
  tier = "production",
}) {
  onProgress?.("segmenting");

  let subjectPath;
  let subjectBuffer;
  let editMaskPath;
  let editMaskBuffer;
  let width;
  let height;
  let tempSubjectPath = null;

  if (artifacts?.userDir && artifacts?.imageId) {
    const saved = await segmentAndSaveArtifacts({
      userDir: artifacts.userDir,
      imageId: artifacts.imageId,
      sourcePath,
    });
    subjectPath = saved.subjectPath;
    subjectBuffer = saved.subjectBuffer;
    editMaskPath = saved.editMaskPath;
    const meta = await sharp(subjectPath).metadata();
    width = meta.width || 1024;
    height = meta.height || 1536;
  } else {
    const segmented = await segmentPersonFromFile(sourcePath);
    subjectBuffer = segmented.subjectBuffer;
    width = segmented.width;
    height = segmented.height;

    const masks = await buildSegmentationMasks(subjectBuffer);
    editMaskBuffer = masks.editMask;

    const tmpDir = path.dirname(outputPath);
    fs.mkdirSync(tmpDir, { recursive: true });
    tempSubjectPath = path.join(tmpDir, `.booth-subject-${Date.now()}.png`);
    subjectPath = tempSubjectPath;
    await fs.promises.writeFile(subjectPath, subjectBuffer);
  }

  onProgress?.("generating");

  const editedBuffer = await generateTransformedImage({
    imagePath: sourcePath,
    prompt: getThemeCostumePrompt(theme),
    negativePrompt: getThemeCostumeNegativePrompt(theme),
    width,
    height,
    tier,
    imageQuality,
    imageInputFidelity,
    maskPath: editMaskPath,
    maskBuffer: editMaskBuffer,
    billing: billing ?? undefined,
  });

  let refinedBuffer = editedBuffer;
  if (isFaceRefineAvailable()) {
    onProgress?.("refining");
    refinedBuffer = await refineEditedFaceFromOriginal({
      originalPath: sourcePath,
      editedBuffer,
      subjectBuffer,
    });
  }

  const costumedSubjectBuffer = await buildCompositeSubjectFromEdited(
    refinedBuffer,
    subjectBuffer
  );

  const processedDir = path.dirname(outputPath);
  const costumedSubjectPath = path.join(
    processedDir,
    `.booth-costumed-subject-${Date.now()}.png`
  );
  await fs.promises.writeFile(costumedSubjectPath, costumedSubjectBuffer);

  onProgress?.("compositing");

  try {
    const { bgSource, overlaysApplied } = await compositeSubjectOntoThemeBackground({
      subjectPath: costumedSubjectPath,
      theme,
      outputPath,
      baseDir,
      width,
      height,
      cleanupSubjectPath: true,
    });

    onProgress?.("finishing");

    return {
      pipeline: "composite-costume",
      bgSource,
      overlaysApplied,
      faceRefined: isFaceRefineAvailable(),
    };
  } finally {
    await fs.promises.unlink(costumedSubjectPath).catch(() => {});
    if (tempSubjectPath) {
      await fs.promises.unlink(tempSubjectPath).catch(() => {});
    }
  }
}

/**
 * @param {unknown} error
 * @returns {string | null}
 */
export function mapCompositeBoothErrorToUserMessage(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (
    message === "person_segmentation_disabled" ||
    message.startsWith("PERSON_SEGMENTATION_TIMEOUT") ||
    message === "invalid_subject_dimensions"
  ) {
    return mapPersonSegmentationErrorToUserMessage(
      error instanceof Error ? error : new Error(message)
    );
  }

  if (message === "background_not_found") {
    return "Background tema belum tersedia. Hubungi staf.";
  }

  if (message === "composite_pipeline_unavailable") {
    return "Pipeline booth belum siap. Hubungi staf.";
  }

  return null;
}
