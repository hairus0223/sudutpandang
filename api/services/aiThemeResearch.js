import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { mapAiGenerationErrorToUserMessage } from "./aiGeneration.js";
import { getOpenAiImageTierOptions, RESEARCH_QUALITY_PRESETS, resolveResearchQualityPreset } from "./packageTypes.js";
import { publishThemeToCatalog, isValidThemeId } from "./aiThemeCatalog.js";
import { generateTransformedImage, OPENAI_MASKED_EDIT_ENABLED } from "./openaiImage.js";
import {
  isFaceRefineAvailable,
  refineEditedFaceFromOriginal,
} from "./faceRefine.js";
import {
  buildSegmentationMasks,
  PERSON_SEGMENTATION_ENABLED,
  segmentPersonFromFile,
} from "./personSegmentation.js";
import { resolveBaseDir } from "./studioPaths.js";
import {
  estimateOpenAiImageCostUsd,
  getOpenAiPricingHints,
} from "./openAiPricing.js";
import { getFaceRefineStatus } from "./faceRefine.js";
import { getAiPipelineStatus } from "./aiGeneration.js";
import { getAiCostSummary } from "./aiAnalytics.js";

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
 *   editMode?: "full" | "masked" | null,
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
  return readStore(baseDir).drafts;
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
 * @returns {{ workingTitle: string, transformPrompt: string, negativePrompt: string, notes: string }}
 */
function normalizeDraftInput(body) {
  const workingTitle = String(body?.workingTitle ?? "").trim();
  const transformPrompt = String(body?.transformPrompt ?? "").trim();
  const negativePrompt = String(body?.negativePrompt ?? "").trim();
  const notes = String(body?.notes ?? "").trim();

  if (!workingTitle) throw new Error("working_title_required");
  if (!transformPrompt) throw new Error("transform_prompt_required");
  if (!negativePrompt) throw new Error("negative_prompt_required");
  if (transformPrompt.length > MAX_PROMPT_LENGTH) throw new Error("prompt_too_long");
  if (negativePrompt.length > MAX_PROMPT_LENGTH) throw new Error("negative_prompt_too_long");

  return { workingTitle, transformPrompt, negativePrompt, notes };
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
 * @param {{ sampleId: string, transformPrompt: string, negativePrompt: string, draftId?: string | null, qualityPreset?: string | null }} params
 */
export async function runResearchPreview(baseDir, publicHost, params) {
  const sampleId = String(params.sampleId ?? "").trim();
  const transformPrompt = String(params.transformPrompt ?? "").trim();
  const negativePrompt = String(params.negativePrompt ?? "").trim();
  const draftId = params.draftId ? String(params.draftId).trim() : null;
  const qualityPreset = resolveResearchQualityPreset(params.qualityPreset);

  if (!sampleId) throw new Error("sample_id_required");
  if (!transformPrompt) throw new Error("transform_prompt_required");
  if (!negativePrompt) throw new Error("negative_prompt_required");
  if (transformPrompt.length > MAX_PROMPT_LENGTH) throw new Error("prompt_too_long");

  const samplePath = getSampleFilePath(baseDir, sampleId);
  if (!samplePath) throw new Error("sample_not_found");

  const meta = await sharp(samplePath).metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1536;

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
    editMode: null,
    qualityPreset: qualityPreset.id,
    quality: qualityPreset.quality,
    inputFidelity: qualityPreset.inputFidelity,
    createdAt: new Date().toISOString(),
  };

  const useMaskedEdit = OPENAI_MASKED_EDIT_ENABLED && PERSON_SEGMENTATION_ENABLED;
  /** @type {Buffer | undefined} */
  let maskBuffer;
  /** @type {Buffer | undefined} */
  let subjectBuffer;

  if (useMaskedEdit) {
    try {
      ({ subjectBuffer } = await segmentPersonFromFile(samplePath));
      ({ editMask: maskBuffer } = await buildSegmentationMasks(subjectBuffer));
      run.editMode = "masked";
    } catch (segErr) {
      const segCode = segErr instanceof Error ? segErr.message : String(segErr);
      console.warn("[ai-theme-research] masked preview fallback to full edit:", segCode);
      run.editMode = "full";
    }
  } else {
    run.editMode = "full";
  }

  try {
    let buffer = await generateTransformedImage({
      imagePath: samplePath,
      prompt: transformPrompt,
      negativePrompt,
      width,
      height,
      tier: "research",
      imageQuality: qualityPreset.quality,
      imageInputFidelity: qualityPreset.inputFidelity,
      ...(maskBuffer ? { maskBuffer } : {}),
      billing: {
        baseDir,
        source: "research",
        runId,
        draftId,
      },
    });

    run.costUsd = estimateOpenAiImageCostUsd({
      tier: "research",
      quality: qualityPreset.quality,
      inputFidelity: qualityPreset.inputFidelity,
    });

    if (isFaceRefineAvailable() && subjectBuffer) {
      buffer = await refineEditedFaceFromOriginal({
        originalPath: samplePath,
        editedBuffer: buffer,
        subjectBuffer,
      });
      run.faceRefined = true;
    }

    const resultFilename = `${runId}.jpg`;
    const resultPath = path.join(getResearchResultsDir(baseDir), resultFilename);
    await sharp(buffer).jpeg({ quality: 92, mozjpeg: true }).toFile(resultPath);

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

  const published = publishThemeToCatalog(baseDir, {
    id,
    label,
    description,
    transformPrompt: draft.transformPrompt,
    negativePrompt: draft.negativePrompt,
    previewColor,
  });

  return published;
}

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
      maskedEditEnabled: pipeline.maskedEditEnabled,
      faceRefine: pipeline.faceRefine,
    },
    usageSummary: {
      days: usage.days,
      researchCalls: usage.totalCalls,
      researchCostUsd: usage.totalCostUsd,
    },
    maskedEditEnabled: OPENAI_MASKED_EDIT_ENABLED && PERSON_SEGMENTATION_ENABLED,
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
