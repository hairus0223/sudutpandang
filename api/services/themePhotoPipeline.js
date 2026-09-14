import fs from "fs";
import path from "path";
import { getAiTheme } from "./aiThemes.js";
import { runCompositeBoothGeneration } from "./aiProBooth.js";
import { readCustomerJson, readCustomerPackageType } from "./customerConfig.js";
import { isThemePhotoPackage } from "./packageTypes.js";
import { resolveBaseDir } from "./studioPaths.js";
import {
  PROCESSING_STATUS,
  findIncompleteThemePhotoJobs,
  findOriginalPath,
  getThemePhotoPath,
  getThemePhotoRelativePath,
  markFailed,
  updateAfterThemePhoto,
  updateStatus,
} from "./imageStorage.js";

/** @type {Promise<void>} */
let themeQueue = Promise.resolve();

function enqueue(task) {
  themeQueue = themeQueue.then(task, task);
  return themeQueue;
}

function readLockedThemeId(userDir) {
  const customer = readCustomerJson(userDir);
  const themeId = customer?.aiThemeId ? String(customer.aiThemeId) : "";
  return themeId || null;
}

/**
 * Auto composite: identical person + theme photo background + lighting. No OpenAI.
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   user: string,
 *   io: { emit: (event: string, payload: unknown) => void },
 *   buildPublicUrl: (relativePath: string) => string,
 *   baseDir?: string,
 * }} options
 */
export async function runThemePhotoPipeline({
  userDir,
  imageId,
  user,
  io,
  buildPublicUrl,
  baseDir = resolveBaseDir(),
  reuseSubject = false,
}) {
  const originalPath = findOriginalPath(userDir, imageId);
  if (!originalPath) {
    throw new Error("original_missing");
  }

  const themeId = readLockedThemeId(userDir);
  const theme = getAiTheme(themeId, baseDir);
  if (!theme) {
    throw new Error("theme_required");
  }

  const printTheme = {
    ...theme,
    overlays: [],
    pipelineMode: "composite-only",
  };

  updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, {
    processingPhase: "compositing",
    error: null,
  });

  const outputPath = getThemePhotoPath(userDir, imageId, theme.id);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const { bgSource } = await runCompositeBoothGeneration({
    sourcePath: originalPath,
    theme: printTheme,
    outputPath,
    baseDir,
    artifacts: { userDir, imageId },
    reuseSubject,
  });

  const relativePath = getThemePhotoRelativePath(imageId, theme.id);
  const updated = updateAfterThemePhoto(userDir, imageId, theme.id, relativePath, {
    bgSource,
  });

  const bust = `v=${Date.now()}`;
  io.emit("photo-processed", {
    user,
    imageId,
    status: PROCESSING_STATUS.READY,
    originalUrl: `${buildPublicUrl(String(updated.variants.original))}?${bust}`,
    themeUrl: `${buildPublicUrl(relativePath)}?${bust}`,
  });
}

export function scheduleThemePhotoPipeline(options) {
  enqueue(async () => {
    try {
      await runThemePhotoPipeline(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[theme-photo] ${options.imageId} failed:`, message);
      markFailed(options.userDir, options.imageId, message);
      const userMessage =
        message === "theme_required" || message === "background_not_found"
          ? "Tema atau latar belum siap. Foto asli tetap tersimpan."
          : "Gagal menyusun foto tema. Foto asli tetap tersimpan.";
      options.io.emit("photo-processed", {
        user: options.user,
        imageId: options.imageId,
        status: PROCESSING_STATUS.FAILED,
        error: userMessage,
      });
    }
  });
}

export function resumeIncompleteThemePhotoJobs({
  baseDir,
  todayFolder,
  io,
  buildPublicUrlForUser,
}) {
  const jobs = findIncompleteThemePhotoJobs(baseDir, todayFolder);
  if (!jobs.length) return;

  console.log(`[theme-photo] resuming ${jobs.length} incomplete job(s)`);
  for (const job of jobs) {
    if (readCustomerPackageType(job.userDir) !== "theme-self-photo") continue;
    scheduleThemePhotoPipeline({
      userDir: job.userDir,
      imageId: job.imageId,
      user: job.user,
      io,
      baseDir,
      buildPublicUrl: (relativePath) =>
        buildPublicUrlForUser(job.user, relativePath),
    });
  }
}

export function shouldRunThemePhotoPipeline(userDir) {
  return isThemePhotoPackage(readCustomerPackageType(userDir));
}

/**
 * Re-run composite only (reuse cutout) so operator sliders feel live.
 * @returns {{ imageId: string } | null}
 */
export function scheduleThemePhotoRetune({
  userDir,
  user,
  imageId,
  io,
  buildPublicUrl,
  baseDir = resolveBaseDir(),
}) {
  if (!shouldRunThemePhotoPipeline(userDir)) return null;

  let targetId = imageId ? String(imageId) : "";
  if (!targetId) {
    const captures = path.join(userDir, "captures");
    if (!fs.existsSync(captures)) return null;
    const files = fs
      .readdirSync(captures)
      .filter((name) => /\.(jpg|jpeg|png)$/i.test(name))
      .sort();
    if (!files.length) return null;
    targetId = path.basename(files[files.length - 1], path.extname(files[files.length - 1]));
  }

  if (!findOriginalPath(userDir, targetId)) return null;

  scheduleThemePhotoPipeline({
    userDir,
    imageId: targetId,
    user,
    io,
    baseDir,
    buildPublicUrl,
    reuseSubject: true,
  });

  return { imageId: targetId };
}
