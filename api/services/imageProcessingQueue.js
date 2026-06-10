import fs from "fs";
import { removeImageBackground } from "./backgroundRemoval.js";
import { compositeSubject } from "./imageComposite.js";
import {
  readCustomerPackageType,
  readCustomerThemeId,
  readPassportBackgroundColor,
} from "./customerConfig.js";
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

/** @typedef {{ operation: string, userDir: string, imageId: string, user?: string, packageType?: string, passportColor?: string, themeId?: string, onComplete?: (result: unknown) => void, onError?: (error: Error) => void }} QueueJob */

class ImageProcessingQueue {
  constructor() {
    /** @type {QueueJob[]} */
    this.queue = [];
    this.processing = false;
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

  async drain() {
    if (this.processing) return;

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) continue;

        const handler = this.handlers.get(job.operation);
        if (!handler) {
          const error = new Error(`Unknown image operation: ${job.operation}`);
          markFailed(job.userDir, job.imageId, error.message);
          job.onError?.(error);
          continue;
        }

        try {
          const result = await handler(job);
          job.onComplete?.(result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          markFailed(job.userDir, job.imageId, err.message);
          job.onError?.(err);
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
async function runPassportComposite(userDir, imageId, passportColor) {
  const subjectPath = getSubjectPath(userDir, imageId);
  const outputPath = getPassportPath(userDir, imageId);

  await compositeSubject({
    subjectPath,
    outputPath,
    background: { type: "solid", color: passportColor },
  });

  return updateAfterPassportBg(userDir, imageId, passportColor);
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {string} themeId
 */
async function runThemeComposite(userDir, imageId, themeId) {
  const subjectPath = getSubjectPath(userDir, imageId);
  const outputPath = getThemedPath(userDir, imageId);

  await applyThemeToSubject({ subjectPath, outputPath, themeId });
  return updateAfterTheme(userDir, imageId, themeId);
}

/**
 * Wire image operation handlers.
 * Safe to call multiple times; replaces previous handlers.
 */
export function registerImageProcessingHandlers() {
  imageProcessingQueue.registerHandler("remove-bg", async (job) => {
    const { userDir, imageId } = job;
    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING);

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
      const meta = await runPassportComposite(userDir, imageId, passportColor);
      return { subjectPath, meta };
    }

    if (packageType === "ai-photo" && THEME_GENERATION_ENABLED) {
      updateAfterRemoveBg(userDir, imageId, "theme");
      const themeId = job.themeId ?? readCustomerThemeId(userDir);
      const meta = await runThemeComposite(userDir, imageId, themeId);
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

    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, { error: null });

    const passportColor =
      job.passportColor ?? readPassportBackgroundColor(userDir);
    const meta = await runPassportComposite(userDir, imageId, passportColor);
    return { meta };
  });

  imageProcessingQueue.registerHandler("apply-theme", async (job) => {
    const { userDir, imageId } = job;
    const subjectPath = getSubjectPath(userDir, imageId);

    if (!fs.existsSync(subjectPath)) {
      throw new Error(`Subject image not found for imageId: ${imageId}`);
    }

    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, { error: null });

    const themeId = job.themeId ?? readCustomerThemeId(userDir);
    const meta = await runThemeComposite(userDir, imageId, themeId);
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
 * @param {(result: unknown) => void} [params.onComplete]
 * @param {(error: Error) => void} [params.onError]
 */
export function enqueueApplyTheme({
  userDir,
  imageId,
  user,
  themeId,
  onComplete,
  onError,
}) {
  imageProcessingQueue.enqueue({
    operation: "apply-theme",
    userDir,
    imageId,
    user,
    themeId,
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

  for (const job of jobs) {
    if (job.status === PROCESSING_STATUS.PROCESSING) {
      updateStatus(job.userDir, job.imageId, PROCESSING_STATUS.PENDING, {
        error: null,
      });
    }
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
