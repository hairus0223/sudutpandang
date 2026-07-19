import fs from "fs";
import {
  mapRemovalErrorToUserMessage,
  removeImageBackground,
} from "./backgroundRemoval.js";
import {
  readCustomerLookId,
  readCustomerPackageType,
  readCustomerThemeId,
  readPassportBackgroundColor,
  readPassportSizeId,
} from "./customerConfig.js";
import { LOOK_DEFAULT_INTENSITY } from "./lookPresets.js";
import { compositePassportPhoto } from "./passportComposite.js";
import {
  applyThemeToSubject,
  THEME_GENERATION_ENABLED,
} from "./themeGeneration.js";
import {
  PROCESSING_STATUS,
  findIncompletePassportJobs,
  findIncompleteThemeJobs,
  findOriginalPath,
  findRecoverableJobs,
  getPassportPath,
  getSubjectPath,
  getThemedPath,
  markFailed,
  updateAfterPassportBg,
  updateAfterRemoveBg,
  updateAfterTheme,
  updateStatus,
  writeSubjectPng,
} from "./imageStorage.js";

const IMAGE_COMPOSITE_TIMEOUT_MS =
  Number(process.env.IMAGE_COMPOSITE_TIMEOUT_MS) || 60_000;

/** @typedef {{ operation: string, userDir: string, imageId: string, user?: string, packageType?: string, passportColor?: string, themeId?: string, lookId?: string, onComplete?: (result: unknown) => void, onError?: (error: Error) => void }} QueueJob */

/**
 * @param {string} operation
 * @param {unknown} error
 * @returns {string}
 */
function mapJobErrorToUserMessage(operation, error) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("COMPOSITE_TIMEOUT")) {
    if (message.includes("passport")) {
      return "Gagal membuat pas foto. Silakan coba lagi atau hubungi staf.";
    }
    if (message.includes("theme")) {
      return "Gagal menerapkan tema AI. Silakan coba lagi atau hubungi staf.";
    }
    return "Proses foto terlalu lama. Silakan coba lagi.";
  }

  if (operation === "remove-bg") {
    // Theme composite runs inside remove-bg for ai-photo; surface that clearly.
    if (
      message.toLowerCase().includes("hue") ||
      message.toLowerCase().includes("theme") ||
      message.includes("COMPOSITE_TIMEOUT:remove-bg-theme")
    ) {
      return "Gagal menerapkan tema AI. Silakan coba lagi atau hubungi staf.";
    }
    return mapRemovalErrorToUserMessage(error);
  }

  if (message.toLowerCase().includes("not found")) {
    return "File foto tidak ditemukan. Silakan ambil ulang foto.";
  }

  if (operation === "apply-passport-bg") {
    return "Gagal membuat pas foto. Silakan coba lagi atau hubungi staf.";
  }

  if (operation === "apply-theme") {
    return "Gagal menerapkan tema AI. Silakan coba lagi atau hubungi staf.";
  }

  return "Proses foto gagal. Silakan coba lagi atau hubungi staf.";
}

/**
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} label
 * @returns {Promise<T>}
 * @template T
 */
function withCompositeTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`COMPOSITE_TIMEOUT:${label}`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

class ImageProcessingQueue {
  constructor() {
    /** @type {QueueJob[]} */
    this.queue = [];
    this.processing = false;
    /** @type {QueueJob | null} */
    this.activeJob = null;
    /** @type {Map<string, (job: QueueJob) => Promise<unknown>>} */
    this.handlers = new Map();
  }

  /**
   * @param {string} operation
   * @param {(job: QueueJob) => Promise<unknown>} handler
   */
  registerHandler(operation, handler) {
    this.handlers.set(operation, handler);
  }

  /**
   * @param {QueueJob} job
   */
  enqueue(job) {
    const alreadyQueued = this.queue.some(
      (queued) =>
        queued.imageId === job.imageId &&
        queued.userDir === job.userDir &&
        queued.operation === job.operation
    );
    if (alreadyQueued) return;

    this.queue.push(job);
    void this.drain();
  }

  get pendingCount() {
    return this.queue.length + (this.processing ? 1 : 0);
  }

  get isProcessing() {
    return this.processing;
  }

  get queuedCount() {
    return this.queue.length;
  }

  /**
   * @param {string} userDir
   */
  countJobsForUserDir(userDir) {
    let count = this.queue.filter((job) => job.userDir === userDir).length;
    if (this.activeJob?.userDir === userDir) count += 1;
    return count;
  }

  async drain() {
    if (this.processing) return;

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) continue;

        this.activeJob = job;

        const handler = this.handlers.get(job.operation);
        if (!handler) {
          const error = new Error(`Unknown image operation: ${job.operation}`);
          markFailed(job.userDir, job.imageId, error.message);
          job.onError?.(error);
          this.activeJob = null;
          continue;
        }

        const startedAt = Date.now();
        console.log(
          `[image-queue] start ${job.operation} imageId=${job.imageId} userDir=${job.userDir}`
        );

        try {
          const result = await handler(job);
          console.log(
            `[image-queue] done ${job.operation} imageId=${job.imageId} ${Date.now() - startedAt}ms`
          );
          job.onComplete?.(result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          const userMessage = mapJobErrorToUserMessage(job.operation, err);
          console.error(
            `[image-queue] failed ${job.operation} imageId=${job.imageId} ${Date.now() - startedAt}ms:`,
            err.message
          );
          markFailed(job.userDir, job.imageId, userMessage);
          job.onError?.(new Error(userMessage));
        } finally {
          this.activeJob = null;
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export const imageProcessingQueue = new ImageProcessingQueue();

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {string} passportColor
 */
async function runPassportComposite(userDir, imageId, passportColor, passportSizeId) {
  const subjectPath = getSubjectPath(userDir, imageId);
  const outputPath = getPassportPath(userDir, imageId);
  const resolvedSizeId = passportSizeId ?? readPassportSizeId(userDir);

  const dimensions = await compositePassportPhoto({
    subjectPath,
    outputPath,
    backgroundColor: passportColor,
    sizeId: resolvedSizeId,
  });

  return updateAfterPassportBg(
    userDir,
    imageId,
    passportColor,
    dimensions.sizeId,
    dimensions
  );
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {string} themeId
 * @param {string} [lookId]
 */
async function runThemeComposite(userDir, imageId, themeId, lookId) {
  const subjectPath = getSubjectPath(userDir, imageId);
  const outputPath = getThemedPath(userDir, imageId);
  const resolvedLookId = lookId ?? readCustomerLookId(userDir);

  const result = await applyThemeToSubject({
    subjectPath,
    outputPath,
    themeId,
    lookId: resolvedLookId,
    lookIntensity: LOOK_DEFAULT_INTENSITY,
  });
  return updateAfterTheme(userDir, imageId, themeId, {
    themeBackgroundSource: result.themeBackgroundSource,
    bakedLookId: result.bakedLookId,
  });
}

/**
 * Wire image operation handlers.
 * Safe to call multiple times; replaces previous handlers.
 */
export function registerImageProcessingHandlers() {
  imageProcessingQueue.registerHandler("remove-bg", async (job) => {
    const { userDir, imageId } = job;
    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, {
      processingPhase: "remove-bg",
    });

    const originalPath = findOriginalPath(userDir, imageId);
    if (!originalPath) {
      throw new Error(`Original image not found for imageId: ${imageId}`);
    }

    const subjectBuffer = await removeImageBackground(originalPath);
    const subjectPath = writeSubjectPng(userDir, imageId, subjectBuffer);

    const packageType =
      job.packageType ?? readCustomerPackageType(userDir);

    if (packageType === "pas-photo") {
      updateAfterRemoveBg(userDir, imageId, "passport");
      const passportColor =
        job.passportColor ?? readPassportBackgroundColor(userDir);
      const passportSizeId =
        job.passportSizeId ?? readPassportSizeId(userDir);
      const meta = await withCompositeTimeout(
        runPassportComposite(
          userDir,
          imageId,
          passportColor,
          passportSizeId
        ),
        IMAGE_COMPOSITE_TIMEOUT_MS,
        "remove-bg-passport"
      );
      return { subjectPath, meta };
    }

    if (packageType === "ai-photo" && THEME_GENERATION_ENABLED) {
      updateAfterRemoveBg(userDir, imageId, "theme");
      const themeId = job.themeId ?? readCustomerThemeId(userDir);
      const lookId = job.lookId ?? readCustomerLookId(userDir);
      const meta = await withCompositeTimeout(
        runThemeComposite(userDir, imageId, themeId, lookId),
        IMAGE_COMPOSITE_TIMEOUT_MS,
        "remove-bg-theme"
      );
      return { subjectPath, meta };
    }

    const meta = updateAfterRemoveBg(userDir, imageId, null);
    return { subjectPath, meta };
  });

  imageProcessingQueue.registerHandler("apply-passport-bg", async (job) => {
    const { userDir, imageId } = job;
    const subjectPath = getSubjectPath(userDir, imageId);

    if (!fs.existsSync(subjectPath)) {
      throw new Error(`Subject image not found for imageId: ${imageId}`);
    }

    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, {
      error: null,
      processingPhase: "apply-passport-bg",
    });

    const passportColor =
      job.passportColor ?? readPassportBackgroundColor(userDir);
    const passportSizeId =
      job.passportSizeId ?? readPassportSizeId(userDir);
    const meta = await withCompositeTimeout(
      runPassportComposite(userDir, imageId, passportColor, passportSizeId),
      IMAGE_COMPOSITE_TIMEOUT_MS,
      "apply-passport-bg"
    );
    return { meta };
  });

  imageProcessingQueue.registerHandler("apply-theme", async (job) => {
    const { userDir, imageId } = job;
    const subjectPath = getSubjectPath(userDir, imageId);

    if (!fs.existsSync(subjectPath)) {
      throw new Error(`Subject image not found for imageId: ${imageId}`);
    }

    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, {
      error: null,
      processingPhase: "apply-theme",
    });

    const themeId = job.themeId ?? readCustomerThemeId(userDir);
    const lookId = job.lookId ?? readCustomerLookId(userDir);
    const meta = await withCompositeTimeout(
      runThemeComposite(userDir, imageId, themeId, lookId),
      IMAGE_COMPOSITE_TIMEOUT_MS,
      "apply-theme"
    );
    return { meta };
  });
}

registerImageProcessingHandlers();

/**
 * @param {object} params
 * @param {string} params.userDir
 * @param {string} params.imageId
 * @param {string} [params.user]
 * @param {string} [params.packageType]
 * @param {string} [params.passportColor]
 * @param {string} [params.themeId]
 * @param {string} [params.lookId]
 * @param {(result: unknown) => void} [params.onComplete]
 * @param {(error: Error) => void} [params.onError]
 */
export function enqueueRemoveBackground({
  userDir,
  imageId,
  user,
  packageType,
  passportColor,
  themeId,
  lookId,
  onComplete,
  onError,
}) {
  imageProcessingQueue.enqueue({
    operation: "remove-bg",
    userDir,
    imageId,
    user,
    packageType,
    passportColor,
    themeId,
    lookId,
    onComplete,
    onError,
  });
}

/**
 * @param {object} params
 * @param {string} params.userDir
 * @param {string} params.imageId
 * @param {string} [params.user]
 * @param {string} [params.passportColor]
 * @param {(result: unknown) => void} [params.onComplete]
 * @param {(error: Error) => void} [params.onError]
 */
export function enqueueApplyPassportBg({
  userDir,
  imageId,
  user,
  passportColor,
  onComplete,
  onError,
}) {
  imageProcessingQueue.enqueue({
    operation: "apply-passport-bg",
    userDir,
    imageId,
    user,
    passportColor,
    onComplete,
    onError,
  });
}

/**
 * @param {object} params
 * @param {string} params.userDir
 * @param {string} params.imageId
 * @param {string} [params.user]
 * @param {string} [params.themeId]
 * @param {string} [params.lookId]
 * @param {(result: unknown) => void} [params.onComplete]
 * @param {(error: Error) => void} [params.onError]
 */
export function enqueueApplyTheme({
  userDir,
  imageId,
  user,
  themeId,
  lookId,
  onComplete,
  onError,
}) {
  imageProcessingQueue.enqueue({
    operation: "apply-theme",
    userDir,
    imageId,
    user,
    themeId,
    lookId,
    onComplete,
    onError,
  });
}

/**
 * Re-enqueue pending/processing jobs after API restart.
 * @param {object} params
 * @param {string} params.baseDir
 * @param {string} params.todayFolder
 * @param {(job: { userDir: string, imageId: string, user: string }) => void} params.onJob
 */
export function recoverPendingJobs({ baseDir, todayFolder, onJob }) {
  const jobs = findRecoverableJobs(baseDir, todayFolder);
  let recovered = 0;

  for (const job of jobs) {
    if (
      process.platform === "win32" &&
      job.status === PROCESSING_STATUS.PROCESSING
    ) {
      markFailed(
        job.userDir,
        job.imageId,
        "Proses foto terputus saat server restart. Silakan proses ulang dari gallery."
      );
      continue;
    }

    if (job.status === PROCESSING_STATUS.PROCESSING) {
      updateStatus(job.userDir, job.imageId, PROCESSING_STATUS.PENDING, {
        error: null,
      });
    }

    onJob(job);
    recovered += 1;
  }

  return recovered;
}

/**
 * @param {object} params
 * @param {string} params.baseDir
 * @param {string} params.todayFolder
 * @param {(job: { userDir: string, imageId: string, user: string }) => void} params.onJob
 */
export function recoverIncompletePassportJobs({ baseDir, todayFolder, onJob }) {
  const jobs = findIncompletePassportJobs(baseDir, todayFolder);

  for (const job of jobs) {
    onJob(job);
  }

  return jobs.length;
}

/**
 * @param {object} params
 * @param {string} params.baseDir
 * @param {string} params.todayFolder
 * @param {(job: { userDir: string, imageId: string, user: string }) => void} params.onJob
 */
export function recoverIncompleteThemeJobs({ baseDir, todayFolder, onJob }) {
  const jobs = findIncompleteThemeJobs(baseDir, todayFolder);

  for (const job of jobs) {
    onJob(job);
  }

  return jobs.length;
}
