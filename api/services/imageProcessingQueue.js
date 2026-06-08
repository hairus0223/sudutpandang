import { removeImageBackground } from "./backgroundRemoval.js";
import {
  PROCESSING_STATUS,
  findOriginalPath,
  findRecoverableJobs,
  markFailed,
  updateStatus,
  writeSubjectPng,
} from "./imageStorage.js";

/** @typedef {{ operation: string, userDir: string, imageId: string, user?: string, onComplete?: (result: unknown) => void, onError?: (error: Error) => void }} QueueJob */

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
        queued.imageId === job.imageId && queued.userDir === job.userDir
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
 * Wire the default remove-background handler.
 * Safe to call multiple times; replaces the previous handler.
 */
export function registerRemoveBgHandler() {
  imageProcessingQueue.registerHandler("remove-bg", async (job) => {
    const { userDir, imageId } = job;
    updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING);

    const originalPath = findOriginalPath(userDir, imageId);
    if (!originalPath) {
      throw new Error(`Original image not found for imageId: ${imageId}`);
    }

    const subjectBuffer = await removeImageBackground(originalPath);
    const subjectPath = writeSubjectPng(userDir, imageId, subjectBuffer);
    const meta = updateStatus(userDir, imageId, PROCESSING_STATUS.READY);

    return { subjectPath, meta };
  });
}

registerRemoveBgHandler();

/**
 * @param {object} params
 * @param {string} params.userDir
 * @param {string} params.imageId
 * @param {string} [params.user]
 * @param {(result: unknown) => void} [params.onComplete]
 * @param {(error: Error) => void} [params.onError]
 */
export function enqueueRemoveBackground({
  userDir,
  imageId,
  user,
  onComplete,
  onError,
}) {
  imageProcessingQueue.enqueue({
    operation: "remove-bg",
    userDir,
    imageId,
    user,
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
