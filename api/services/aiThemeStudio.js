import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  BOOTH_THEME_DEFAULTS,
  BUNDLED_AI_THEMES,
  buildCostumeNegative,
  buildCostumePrompt,
  normalizePipelineMode,
} from "./aiThemeCatalog.js";
import { normalizeThemePlacement } from "./aiThemePlacement.js";

export const CUSTOM_COSTUME_PRESET_ID = "custom";

const BG_BASENAMES = ["bg", "background"];
const BG_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PORTRAIT_WIDTH = 1536;
const PORTRAIT_HEIGHT = 2048;

/**
 * @returns {Array<{ id: string, label: string, description: string, previewColor: string }>}
 */
export function listCostumePresets() {
  return BUNDLED_AI_THEMES.map((theme) => ({
    id: theme.id,
    label: theme.label,
    description: theme.description,
    previewColor: theme.previewColor,
  }));
}

/**
 * @param {string} draftId
 * @returns {string}
 */
export function getDraftBackgroundStagingId(draftId) {
  return `__draft_${draftId}`;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 */
export function getDraftBackgroundDir(baseDir, draftId) {
  return path.join(baseDir, "research", "draft-themes", draftId);
}

/**
 * @param {string} dir
 * @param {string} basename
 */
function findBackgroundFileInDir(dir, basename) {
  if (!fs.existsSync(dir)) return null;

  for (const ext of BG_EXTENSIONS) {
    const candidate = path.join(dir, `${basename}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 * @returns {string | null}
 */
export function getDraftBackgroundPath(baseDir, draftId) {
  const dir = getDraftBackgroundDir(baseDir, draftId);

  for (const basename of BG_BASENAMES) {
    const found = findBackgroundFileInDir(dir, basename);
    if (found) return found;
  }

  return null;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 * @returns {boolean}
 */
export function draftHasBackground(baseDir, draftId) {
  return Boolean(getDraftBackgroundPath(baseDir, draftId));
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 * @param {Buffer} buffer
 */
export async function saveDraftBackground(baseDir, draftId, buffer) {
  const dir = getDraftBackgroundDir(baseDir, draftId);
  fs.mkdirSync(dir, { recursive: true });

  const destPath = path.join(dir, "bg.jpg");
  await sharp(buffer)
    .rotate()
    .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(destPath);

  return destPath;
}

/**
 * Copy draft background into studio themes folder for booth preview.
 * @param {string} baseDir
 * @param {string} draftId
 */
export async function syncDraftBackgroundForPreview(baseDir, draftId) {
  const src = getDraftBackgroundPath(baseDir, draftId);
  if (!src) {
    throw new Error("background_required");
  }

  const stagingId = getDraftBackgroundStagingId(draftId);
  const destDir = path.join(baseDir, "themes", stagingId);
  fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, "bg.jpg");
  await fs.promises.copyFile(src, destPath);
  return stagingId;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 * @param {string} themeId
 */
export function publishDraftBackground(baseDir, draftId, themeId) {
  const src = getDraftBackgroundPath(baseDir, draftId);
  if (!src) {
    throw new Error("background_required");
  }

  const destDir = path.join(baseDir, "themes", themeId);
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, "bg.jpg");
  fs.copyFileSync(src, destPath);
  return destPath;
}

/**
 * @param {string} baseDir
 * @param {string} draftId
 */
export async function cleanupDraftBackgroundStaging(baseDir, draftId) {
  const stagingDir = path.join(baseDir, "themes", getDraftBackgroundStagingId(draftId));
  if (fs.existsSync(stagingDir)) {
    await fs.promises.rm(stagingDir, { recursive: true, force: true });
  }
}

/**
 * @param {import("./aiThemeResearch.js").ResearchDraft} draft
 * @param {{ forPreview?: boolean, publishId?: string }} [options]
 * @returns {import("./aiThemeCatalog.js").AiTheme}
 */
export function buildThemeFromDraft(draft, options = {}) {
  const presetId = String(draft.costumePresetId ?? "wild-west").trim();
  const bundled = BUNDLED_AI_THEMES.find((theme) => theme.id === presetId);

  let costumePrompt;
  let costumeNegativePrompt;
  let transformPrompt = String(draft.transformPrompt ?? "").trim();
  let negativePrompt = String(draft.negativePrompt ?? "").trim();

  if (presetId === CUSTOM_COSTUME_PRESET_ID) {
    const wardrobe = String(draft.customWardrobe ?? "").trim();
    if (!wardrobe) {
      throw new Error("custom_wardrobe_required");
    }
    costumePrompt = buildCostumePrompt(wardrobe);
    costumeNegativePrompt = buildCostumeNegative("");
    if (!transformPrompt) transformPrompt = costumePrompt;
    if (!negativePrompt) negativePrompt = costumeNegativePrompt;
  } else if (bundled) {
    costumePrompt = bundled.costumePrompt;
    costumeNegativePrompt = bundled.costumeNegativePrompt;
    if (!transformPrompt) transformPrompt = bundled.transformPrompt;
    if (!negativePrompt) negativePrompt = bundled.negativePrompt;
  } else {
    throw new Error("invalid_costume_preset");
  }

  const publishId = String(options.publishId ?? draft.themeId ?? "").trim();
  const label = String(draft.label ?? draft.workingTitle ?? "").trim();
  const description =
    String(draft.description ?? "").trim() || label || draft.workingTitle;

  const backgroundThemeId = options.forPreview
    ? getDraftBackgroundStagingId(draft.id)
    : publishId || draft.themeId || draft.id;

  const lookId = String(draft.lookId ?? bundled?.lookId ?? BOOTH_THEME_DEFAULTS.lookId ?? "warm").trim();
  const placement = normalizeThemePlacement(
    draft.placement ?? bundled?.placement ?? BOOTH_THEME_DEFAULTS.placement
  );
  const overlays =
    Array.isArray(draft.overlays) && draft.overlays.length
      ? draft.overlays
      : bundled?.overlays ?? BOOTH_THEME_DEFAULTS.overlays;

  return {
    id: options.forPreview ? "draft-preview" : publishId,
    label,
    description,
    transformPrompt,
    negativePrompt,
    costumePrompt,
    costumeNegativePrompt,
    previewColor: String(draft.previewColor ?? bundled?.previewColor ?? "#888888").trim(),
    pipelineMode: normalizePipelineMode(draft.pipelineMode ?? bundled?.pipelineMode),
    backgroundRequired: true,
    backgroundThemeId,
    lookId,
    placement,
    overlays,
  };
}

/**
 * @param {string} baseDir
 * @param {string} publicHost
 * @param {import("./aiThemeResearch.js").ResearchDraft} draft
 */
export function toPublicDraftBackground(baseDir, publicHost, draft) {
  const bgPath = getDraftBackgroundPath(baseDir, draft.id);
  if (!bgPath) {
    return { backgroundReady: false };
  }

  const mtime = fs.statSync(bgPath).mtimeMs;
  return {
    backgroundReady: true,
    backgroundUrl: `http://${publicHost}/research/files/draft-themes/${draft.id}/bg.jpg?v=${Math.floor(mtime)}`,
  };
}
