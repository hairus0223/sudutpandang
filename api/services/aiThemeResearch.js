import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { mapAiGenerationErrorToUserMessage } from "./aiGeneration.js";
import { getOpenAiImageTierOptions, RESEARCH_QUALITY_PRESETS, resolveResearchQualityPreset } from "./packageTypes.js";
import { publishThemeToCatalog, isValidThemeId } from "./aiThemeCatalog.js";
import { generateTransformedImage } from "./openaiImage.js";
import { getAiTheme, normalizeAiThemeId } from "./aiThemes.js";
import {
  resolveEffectivePipeline,
  runCompositeBoothGeneration,
  runCompositeCostumeBoothGeneration,
} from "./aiProBooth.js";
import { resolveBaseDir } from "./studioPaths.js";
import {
  estimateOpenAiImageCostUsd,
  getOpenAiPricingHints,
} from "./openAiPricing.js";
import { getAiPipelineStatus } from "./aiGeneration.js";
import { getAiCostSummary } from "./aiAnalytics.js";
import {
  buildThemeFromDraft,
  cleanupDraftBackgroundStaging,
  draftHasBackground,
  listCostumePresets,
  publishDraftBackground,
  saveDraftBackground,
  syncDraftBackgroundForPreview,
  toPublicDraftBackground,
} from "./aiThemeStudio.js";

const RESEARCH_IMAGE_MAX_BYTES =
  Number(process.env.AI_RESEARCH_IMAGE_MAX_BYTES) || 20 * 1024 * 1024;

const MAX_PROMPT_LENGTH = 8000;
const MAX_DRAFTS = 100;
const MAX_RUNS = 200;

/** @typedef {{
 *   id: string,
 *   filename: string,
 *   originalName: string,
 *   createdAt: string,
 * }} ResearchSample */

/** @typedef {{
 *   id: string,
 *   workingTitle: string,
 *   transformPrompt: string,
 *   negativePrompt: string,
 *   notes: string,
 *   themeId?: string,
 *   label?: string,
 *   description?: string,
 *   previewColor?: string,
 *   pipelineMode?: import("./aiThemeCatalog.js").AiPipelineMode,
 *   costumePresetId?: string,
 *   customWardrobe?: string,
 *   promptMode?: "studio" | "advanced",
 *   backgroundReady?: boolean,
 *   createdAt: string,
 *   updatedAt: string,
 * }} ResearchDraft */

/** @typedef {{
 *   id: string,
 *   draftId: string | null,
 *   sampleId: string,
 *   resultFilename: string | null,
 *   transformPrompt: string,
 *   negativePrompt: string,
 *   durationMs: number,
 *   status: "ready" | "failed",
 *   error: string | null,
 *   errorCode?: string | null,
 *   editMode?: "full" | "masked" | "composite" | "composite-costume" | null,
 *   faceRefined?: boolean,
 *   qualityPreset?: string | null,
 *   quality?: string | null,
 *   inputFidelity?: string | null,
 *   costUsd?: number | null,
 *   createdAt: string,
 * }} ResearchRun */

/**
 * @param {string} baseDir
 */
export function getResearchRoot(baseDir = resolveBaseDir()) {
  return path.join(baseDir, "research");
}

/**
 * @param {string} baseDir
 */
export function getResearchSamplesDir(baseDir = resolveBaseDir()) {
  return path.join(getResearchRoot(baseDir), "samples");
}

/**
 * @param {string} baseDir
 */
export function getResearchResultsDir(baseDir = resolveBaseDir()) {
  return path.join(getResearchRoot(baseDir), "results");
}

/**
 * @param {string} baseDir
 */
export function getResearchStorePath(baseDir = resolveBaseDir()) {
  return path.join(baseDir, "data", "ai-theme-research.json");
}

/**
 * @param {string} baseDir
 */
function ensureResearchDirs(baseDir) {
  fs.mkdirSync(getResearchSamplesDir(baseDir), { recursive: true });
  fs.mkdirSync(getResearchResultsDir(baseDir), { recursive: true });
  fs.mkdirSync(path.dirname(getResearchStorePath(baseDir)), { recursive: true });
}

/**
 * @returns {{ version: number, samples: ResearchSample[], drafts: ResearchDraft[], runs: ResearchRun[] }}
 */
function defaultStore() {
  return { version: 1, samples: [], drafts: [], runs: [] };
}

/**
 * @param {string} baseDir
 */
function readStore(baseDir) {
  ensureResearchDirs(baseDir);
  const storePath = getResearchStorePath(baseDir);
  if (!fs.existsSync(storePath)) {
    const empty = defaultStore();
    fs.writeFileSync(storePath, JSON.stringify(empty, null, 2));
    return empty;
  }

  const raw = JSON.parse(fs.readFileSync(storePath, "utf-8"));
  return {
    version: typeof raw.version === "number" ? raw.version : 1,
    samples: Array.isArray(raw.samples) ? raw.samples : [],
    drafts: Array.isArray(raw.drafts) ? raw.drafts : [],
    runs: Array.isArray(raw.runs) ? raw.runs : [],
  };
}

/**
 * @param {string} baseDir
 * @param {{ version: number, samples: ResearchSample[], drafts: ResearchDraft[], runs: ResearchRun[] }} store
 */
function writeStore(baseDir, store) {
  ensureResearchDirs(baseDir);
  fs.writeFileSync(getResearchStorePath(baseDir), JSON.stringify(store, null, 2));
}

/**
 * @param {string} publicHost
 * @param {ResearchSample} sample
 */
export function toPublicSample(publicHost, sample) {
  return {
    id: sample.id,
    originalName: sample.originalName,
    url: `http://${publicHost}/research/files/samples/${sample.filename}`,
    createdAt: sample.createdAt,
  };
}

/**
 * @param {string} publicHost
 * @param {ResearchRun} run
 */
export function toPublicRun(publicHost, run) {
  return {
    id: run.id,
    draftId: run.draftId,
    sampleId: run.sampleId,
    transformPrompt: run.transformPrompt,
    negativePrompt: run.negativePrompt,
    durationMs: run.durationMs,
    status: run.status,
    error: run.error,
    ...(run.errorCode ? { errorCode: run.errorCode } : {}),
    ...(run.editMode ? { editMode: run.editMode } : {}),
    ...(run.faceRefined ? { faceRefined: run.faceRefined } : {}),
    ...(run.qualityPreset ? { qualityPreset: run.qualityPreset } : {}),
    ...(run.quality ? { quality: run.quality } : {}),
    ...(run.inputFidelity ? { inputFidelity: run.inputFidelity } : {}),
    ...(typeof run.costUsd === "number" ? { costUsd: run.costUsd } : {}),
    createdAt: run.createdAt,
    ...(run.resultFilename
      ? { resultUrl: `http://${publicHost}/research/files/results/${run.resultFilename}` }
      : {}),
  };
}

/**
 * @param {string} baseDir
 * @param {string} publicHost
 */
export function listResearchSamples(baseDir, publicHost) {
  const store = readStore(baseDir);
  return store.samples.map((sample) => toPublicSample(publicHost, sample));
}

/**
 * @param {string} baseDir
 */
export function listResearchDrafts(baseDir) {
  return readStore(baseDir).drafts.map((draft) => ({
    ...draft,
    backgroundReady: draftHasBackground(baseDir, draft.id),
  }));
}

/**
 * @param {string} baseDir
 * @param {string} publicHost
 */
export function listResearchDraftsPublic(baseDir, publicHost) {
  return listResearchDrafts(baseDir).map((draft) => ({
    ...draft,
    ...toPublicDraftBackground(baseDir, publicHost, draft),
  }));
}

/**
 * @param {string} baseDir
 * @param {string} publicHost
 * @param {{ limit?: number }} [options]
 */
export function listResearchRuns(baseDir, publicHost, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), MAX_RUNS);
  const runs = readStore(baseDir).runs;
  return runs
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((run) => toPublicRun(publicHost, run));
}

/**
 * @param {string} baseDir
 * @param {{ buffer: Buffer, originalName: string, mimeType: string }} params
 */
export function addResearchSample(baseDir, { buffer, originalName, mimeType }) {
  if (buffer.length > RESEARCH_IMAGE_MAX_BYTES) {
    throw new Error("file_too_large");
  }
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)) {
    throw new Error("invalid_file_type");
  }

  const store = readStore(baseDir);
  const id = crypto.randomUUID();
  const ext = mimeType.includes("png")
    ? ".png"
    : mimeType.includes("webp")
      ? ".webp"
      : ".jpg";
  const filename = `${id}${ext}`;
  const destPath = path.join(getResearchSamplesDir(baseDir), filename);
  fs.writeFileSync(destPath, buffer);

  const sample = /** @type {ResearchSample} */ ({
    id,
    filename,
    originalName: originalName || filename,
    createdAt: new Date().toISOString(),
  });

  store.samples.unshift(sample);
  writeStore(baseDir, store);
  return sample;
}

/**
 * @param {string} baseDir
 * @param {string} sampleId
 */
export function deleteResearchSample(baseDir, sampleId) {
  const store = readStore(baseDir);
  const sample = store.samples.find((entry) => entry.id === sampleId);
  if (!sample) {
    throw new Error("sample_not_found");
  }

  const filePath = path.join(getResearchSamplesDir(baseDir), sample.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  store.samples = store.samples.filter((entry) => entry.id !== sampleId);
  writeStore(baseDir, store);
  return true;
}

/**
 * @param {string} baseDir
 * @param {string} sampleId
 */
export function getSampleFilePath(baseDir, sampleId) {
  const store = readStore(baseDir);
  const sample = store.samples.find((entry) => entry.id === sampleId);
  if (!sample) return null;
  const filePath = path.join(getResearchSamplesDir(baseDir), sample.filename);
  return fs.existsSync(filePath) ? filePath : null;
}

/**
 * @param {unknown} body
 * @returns {Omit<ResearchDraft, "id" | "createdAt" | "updatedAt">}
 */
function normalizeDraftInput(body) {
  const workingTitle = String(body?.workingTitle ?? "").trim();
  const themeId = String(body?.themeId ?? "").trim();
  const label = String(body?.label ?? workingTitle).trim();
  const description = String(body?.description ?? label).trim();
  const previewColor = String(body?.previewColor ?? "#888888").trim();
  const pipelineMode = String(body?.pipelineMode ?? "composite-costume").trim();
  const costumePresetId = String(body?.costumePresetId ?? "wild-west").trim();
  const customWardrobe = String(body?.customWardrobe ?? "").trim();
  const notes = String(body?.notes ?? "").trim();
  const transformPrompt = String(body?.transformPrompt ?? "").trim();
  const negativePrompt = String(body?.negativePrompt ?? "").trim();
  const promptMode = body?.promptMode === "advanced" ? "advanced" : "studio";

  if (!workingTitle) throw new Error("working_title_required");

  const studioConfigured =
    (costumePresetId && costumePresetId !== "custom") ||
    (costumePresetId === "custom" && customWardrobe);

  if (promptMode === "advanced" || !studioConfigured) {
    if (!transformPrompt) throw new Error("transform_prompt_required");
    if (!negativePrompt) throw new Error("negative_prompt_required");
  } else if (costumePresetId === "custom" && !customWardrobe) {
    throw new Error("custom_wardrobe_required");
  }

  if (transformPrompt.length > MAX_PROMPT_LENGTH) throw new Error("prompt_too_long");
  if (negativePrompt.length > MAX_PROMPT_LENGTH) throw new Error("negative_prompt_too_long");

  /** @type {Omit<ResearchDraft, "id" | "createdAt" | "updatedAt">} */
  const draft = {
    workingTitle,
    transformPrompt,
    negativePrompt,
    notes,
    themeId,
    label,
    description,
    previewColor,
    pipelineMode: /** @type {import("./aiThemeCatalog.js").AiPipelineMode} */ (pipelineMode),
    costumePresetId,
    customWardrobe,
    promptMode,
    backgroundReady: Boolean(body?.backgroundReady),
  };

  if (studioConfigured && promptMode !== "advanced") {
    try {
      const built = buildThemeFromDraft(
        /** @type {ResearchDraft} */ ({ id: "draft", ...draft })
      );
      draft.transformPrompt = built.transformPrompt;
      draft.negativePrompt = built.negativePrompt;
    } catch {
      // keep user-provided prompts when preset build fails mid-save
    }
  }

  return draft;
}

/**
 * @param {string} baseDir
 * @param {unknown} body
 */
export function createResearchDraft(baseDir, body) {
  const input = normalizeDraftInput(body);
  const store = readStore(baseDir);

  const draft = /** @type {ResearchDraft} */ ({
    id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  store.drafts.unshift(draft);
  if (store.drafts.length > MAX_DRAFTS) {
    store.drafts = store.drafts.slice(0, MAX_DRAFTS);
  }
  writeStore(baseDir, store);
  return draft;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 * @param {unknown} body
 */
export function updateResearchDraft(baseDir, draftId, body) {
  const input = normalizeDraftInput(body);
  const store = readStore(baseDir);
  const idx = store.drafts.findIndex((entry) => entry.id === draftId);
  if (idx < 0) throw new Error("draft_not_found");

  const updated = {
    ...store.drafts[idx],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  store.drafts[idx] = updated;
  writeStore(baseDir, store);
  return updated;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 */
export function deleteResearchDraft(baseDir, draftId) {
  const store = readStore(baseDir);
  const before = store.drafts.length;
  store.drafts = store.drafts.filter((entry) => entry.id !== draftId);
  if (store.drafts.length === before) throw new Error("draft_not_found");
  writeStore(baseDir, store);
  return true;
}

/**
 * @param {string} baseDir
 * @param {string} publicHost
 * @param {{ sampleId: string, transformPrompt: string, negativePrompt: string, draftId?: string | null, qualityPreset?: string | null, themeId?: string | null }} params
 */
export async function runResearchPreview(baseDir, publicHost, params) {
  const sampleId = String(params.sampleId ?? "").trim();
  const draftId = params.draftId ? String(params.draftId).trim() : null;
  const qualityPreset = resolveResearchQualityPreset(params.qualityPreset);

  if (!sampleId) throw new Error("sample_id_required");

  const samplePath = getSampleFilePath(baseDir, sampleId);
  if (!samplePath) throw new Error("sample_not_found");

  const meta = await sharp(samplePath).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1536;

  let theme = getAiTheme(normalizeAiThemeId(params.themeId || "wild-west", baseDir), baseDir);
  let transformPrompt = String(params.transformPrompt ?? "").trim();
  let negativePrompt = String(params.negativePrompt ?? "").trim();
  let useStudioDraft = false;

  if (draftId) {
    const store = readStore(baseDir);
    const draft = store.drafts.find((entry) => entry.id === draftId);
    if (!draft) throw new Error("draft_not_found");
    if (!draftHasBackground(baseDir, draftId)) {
      throw new Error("background_required");
    }

    await syncDraftBackgroundForPreview(baseDir, draftId);
    theme = buildThemeFromDraft(draft, { forPreview: true });
    transformPrompt = theme.transformPrompt;
    negativePrompt = theme.negativePrompt;
    useStudioDraft = true;
  } else {
    if (!transformPrompt) throw new Error("transform_prompt_required");
    if (!negativePrompt) throw new Error("negative_prompt_required");
    if (transformPrompt.length > MAX_PROMPT_LENGTH) throw new Error("prompt_too_long");
    if (!theme) throw new Error("invalid_theme");
  }

  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  /** @type {ResearchRun} */
  const run = {
    id: runId,
    draftId,
    sampleId,
    resultFilename: null,
    transformPrompt,
    negativePrompt,
    durationMs: 0,
    status: "failed",
    error: null,
    errorCode: null,
    editMode: "full",
    qualityPreset: qualityPreset.id,
    quality: qualityPreset.quality,
    inputFidelity: qualityPreset.inputFidelity,
    createdAt: new Date().toISOString(),
  };

  try {
    if (!theme) {
      throw new Error("invalid_theme");
    }

    const pipeline = resolveEffectivePipeline(theme);
    const resultFilename = `${runId}.jpg`;
    const resultPath = path.join(getResearchResultsDir(baseDir), resultFilename);

    if (pipeline === "composite-costume") {
      run.editMode = "composite-costume";
      const { bgSource, faceRefined } = await runCompositeCostumeBoothGeneration({
        sourcePath: samplePath,
        theme,
        outputPath: resultPath,
        baseDir,
        billing: {
          baseDir,
          source: "research",
          runId,
          draftId: draftId ?? undefined,
        },
        tier: "research",
        imageQuality: qualityPreset.quality,
        imageInputFidelity: qualityPreset.inputFidelity,
      });
      run.costUsd = estimateOpenAiImageCostUsd({
        tier: "research",
        quality: qualityPreset.quality,
        inputFidelity: qualityPreset.inputFidelity,
      });
      run.faceRefined = faceRefined;
      console.log(
        `[ai-theme-research] composite-costume preview theme=${theme.id} bg=${bgSource} faceRefined=${faceRefined}`
      );
    } else if (pipeline === "composite-only") {
      run.editMode = "composite";
      const { bgSource } = await runCompositeBoothGeneration({
        sourcePath: samplePath,
        theme,
        outputPath: resultPath,
        baseDir,
      });
      run.costUsd = 0;
      console.log(`[ai-theme-research] composite preview theme=${theme.id} bg=${bgSource}`);
    } else {
      const buffer = await generateTransformedImage({
        imagePath: samplePath,
        prompt: transformPrompt,
        negativePrompt,
        width,
        height,
        tier: "research",
        imageQuality: qualityPreset.quality,
        imageInputFidelity: qualityPreset.inputFidelity,
        billing: {
          baseDir,
          source: "research",
          runId,
          draftId: draftId ?? undefined,
        },
      });

      run.costUsd = estimateOpenAiImageCostUsd({
        tier: "research",
        quality: qualityPreset.quality,
        inputFidelity: qualityPreset.inputFidelity,
      });

      await sharp(buffer).jpeg({ quality: 92, mozjpeg: true }).toFile(resultPath);
    }

    run.resultFilename = resultFilename;
    run.status = "ready";
    run.durationMs = Date.now() - startedAt;
  } catch (err) {
    run.durationMs = Date.now() - startedAt;
    const code = err instanceof Error ? err.message : String(err);
    run.errorCode = code;
    run.error = mapAiGenerationErrorToUserMessage(err);
    run.status = "failed";
    console.warn("[ai-theme-research] preview failed:", code);
  } finally {
    if (useStudioDraft && draftId) {
      await cleanupDraftBackgroundStaging(baseDir, draftId).catch(() => {});
    }
  }

  const store = readStore(baseDir);
  store.runs.unshift(run);
  if (store.runs.length > MAX_RUNS) {
    store.runs = store.runs.slice(0, MAX_RUNS);
  }
  writeStore(baseDir, store);

  return toPublicRun(publicHost, run);
}

/**
 * @param {string} baseDir
 * @param {{ draftId: string, id: string, label: string, description?: string, previewColor?: string }} params
 */
export function publishDraftAsTheme(baseDir, params) {
  const draftId = String(params.draftId ?? "").trim();
  const id = String(params.id ?? "").trim();
  const label = String(params.label ?? "").trim();
  const description = String(params.description ?? "").trim() || label;
  const previewColor = String(params.previewColor ?? "#888888").trim();

  if (!draftId) throw new Error("draft_id_required");
  if (!isValidThemeId(id)) throw new Error("invalid_theme_id");
  if (!label) throw new Error("label_required");

  const store = readStore(baseDir);
  const draft = store.drafts.find((entry) => entry.id === draftId);
  if (!draft) throw new Error("draft_not_found");
  if (!draftHasBackground(baseDir, draftId)) {
    throw new Error("background_required");
  }

  const theme = buildThemeFromDraft(
    {
      ...draft,
      themeId: id,
      label,
      description,
      previewColor,
    },
    { publishId: id }
  );

  publishDraftBackground(baseDir, draftId, id);
  const published = publishThemeToCatalog(baseDir, theme);
  cleanupDraftBackgroundStaging(baseDir, draftId).catch(() => {});

  return published;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 * @param {Buffer} buffer
 */
export async function uploadDraftBackground(baseDir, draftId, buffer) {
  const store = readStore(baseDir);
  const draft = store.drafts.find((entry) => entry.id === draftId);
  if (!draft) throw new Error("draft_not_found");

  await saveDraftBackground(baseDir, draftId, buffer);

  const idx = store.drafts.findIndex((entry) => entry.id === draftId);
  store.drafts[idx] = {
    ...store.drafts[idx],
    backgroundReady: true,
    updatedAt: new Date().toISOString(),
  };
  writeStore(baseDir, store);
  return store.drafts[idx];
}

export { listCostumePresets };

/**
 * @param {string} baseDir
 * @param {string} publicHost
 */
export function getResearchMeta(baseDir, publicHost) {
  const store = readStore(baseDir);
  const researchTier = getOpenAiImageTierOptions("research");
  const productionTier = getOpenAiImageTierOptions("production");
  const pricing = getOpenAiPricingHints();
  const pipeline = getAiPipelineStatus();
  const usage = getAiCostSummary(baseDir, { days: 30, source: "research" });
  const qualityPresets = RESEARCH_QUALITY_PRESETS.map((preset) => ({
    ...preset,
    costUsd: estimateOpenAiImageCostUsd({
      tier: "research",
      quality: preset.quality,
      inputFidelity: preset.inputFidelity,
    }),
  }));

  return {
    ok: true,
    service: "ai-theme-research",
    sampleCount: store.samples.length,
    draftCount: store.drafts.length,
    runCount: store.runs.length,
    samplesDir: getResearchSamplesDir(baseDir),
    resultsDir: getResearchResultsDir(baseDir),
    storePath: getResearchStorePath(baseDir),
    publicHost,
    maxPromptLength: MAX_PROMPT_LENGTH,
    maxImageBytes: RESEARCH_IMAGE_MAX_BYTES,
    openaiTier: {
      research: researchTier,
      production: productionTier,
    },
    pricing,
    qualityPresets,
    pipeline: {
      name: pipeline.pipeline,
      compositeBoothAvailable: pipeline.compositeBoothAvailable,
      costumePassAvailable: pipeline.costumePassAvailable,
    },
    costumePresets: listCostumePresets(),
    studio: {
      version: 2,
      defaultPipelineMode: "composite-costume",
    },
    usageSummary: {
      days: usage.days,
      researchCalls: usage.totalCalls,
      researchCostUsd: usage.totalCostUsd,
    },
  };
}

/**
 * @param {unknown} error
 * @returns {{ status: number, body: { ok: false, error: string, message?: string } }}
 */
export function mapResearchError(error) {
  const code = error instanceof Error ? error.message : String(error ?? "unknown");

  const clientErrors = {
    working_title_required: 400,
    transform_prompt_required: 400,
    negative_prompt_required: 400,
    prompt_too_long: 400,
    negative_prompt_too_long: 400,
    sample_id_required: 400,
    draft_id_required: 400,
    invalid_theme_id: 400,
    label_required: 400,
    file_required: 400,
    file_too_large: 400,
    invalid_file_type: 400,
    sample_not_found: 404,
    draft_not_found: 404,
    invalid_theme_payload: 400,
    background_required: 400,
    custom_wardrobe_required: 400,
    invalid_costume_preset: 400,
  };

  if (code in clientErrors) {
    return {
      status: clientErrors[code],
      body: { ok: false, error: code },
    };
  }

  if (code.startsWith("openai_") || code === "original_not_found") {
    return {
      status: 502,
      body: {
        ok: false,
        error: code,
        message: mapAiGenerationErrorToUserMessage(error),
      },
    };
  }

  return {
    status: 500,
    body: { ok: false, error: "internal_error", message: code },
  };
}
