import path from "path";
import {
  releaseAiQuota,
  upsertAiSelection,
} from "./aiCustomer.js";
import { logAiAnalyticsEvent } from "./aiAnalytics.js";
import {
  getAiGenerationInitialPhase,
  getAiGenerationInitialPhaseForTheme,
  mapAiGenerationErrorToUserMessage,
  runAiGeneration,
} from "./aiGeneration.js";
import { buildAiJobId, getAiTheme } from "./aiThemes.js";
import { getAiGenerationConfig } from "./packageTypes.js";
import { resolveBaseDir } from "./studioPaths.js";

/** @typedef {{
 *   jobId: string,
 *   user: string,
 *   userDir: string,
 *   imageId: string,
 *   themeId: string,
 *   todayFolder: string,
 *   host: string,
 *   emitProgress: (payload: Record<string, unknown>) => void,
 *   emitComplete: (payload: Record<string, unknown>) => void,
 * }} AiQueueJob */

class AiGenerationQueue {
  constructor() {
    /** @type {AiQueueJob[]} */
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrent = getAiGenerationConfig().maxConcurrent;
  }

  /**
   * @param {AiQueueJob} job
   */
  enqueue(job) {
    this.queue.push(job);
    this.pump();
  }

  pump() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      this.activeCount += 1;
      this.runJob(job)
        .catch((err) => {
          console.error("[ai-queue] unhandled job error:", err);
        })
        .finally(() => {
          this.activeCount -= 1;
          this.pump();
        });
    }
  }

  /**
   * @param {AiQueueJob} job
   */
  async runJob(job) {
    const { userDir, user, imageId, themeId, jobId, todayFolder, host } = job;
    const baseDir = resolveBaseDir();
    const startedAt = Date.now();

    const theme = getAiTheme(themeId);
    const initialPhase = theme
      ? getAiGenerationInitialPhaseForTheme(theme)
      : getAiGenerationInitialPhase();

    logAiAnalyticsEvent(baseDir, {
      type: "generate_started",
      user,
      imageId,
      themeId,
      jobId,
      themeType: theme ? "transform" : null,
    });

    upsertAiSelection(userDir, {
      imageId,
      themeId,
      jobId,
      status: "processing",
      phase: initialPhase,
      error: null,
    });

    job.emitProgress({
      user,
      imageId,
      themeId,
      jobId,
      status: "processing",
      phase: initialPhase,
    });

    try {
      const result = await runAiGeneration({
        userDir,
        imageId,
        themeId,
        jobId,
        user,
        onProgress: (phase) => {
          upsertAiSelection(userDir, {
            imageId,
            themeId,
            jobId,
            status: "processing",
            phase,
          });
          job.emitProgress({
            user,
            imageId,
            themeId,
            jobId,
            status: "processing",
            phase,
          });
        },
      });

      const relativePath = result.relativePath.split(path.sep).join("/");
      const aiUrl = `http://${host}/images/${todayFolder}/${user}/${relativePath}`;

      upsertAiSelection(userDir, {
        imageId,
        themeId,
        jobId,
        status: "ready",
        phase: null,
        outputPath: relativePath,
        error: null,
      });

      job.emitComplete({
        user,
        imageId,
        themeId,
        jobId,
        status: "ready",
        aiUrl,
        outputPath: relativePath,
      });

      logAiAnalyticsEvent(baseDir, {
        type: "generate_success",
        user,
        imageId,
        themeId,
        jobId,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      const userMessage = mapAiGenerationErrorToUserMessage(err);

      releaseAiQuota(userDir);

      upsertAiSelection(userDir, {
        imageId,
        themeId,
        jobId,
        status: "failed",
        phase: null,
        error: userMessage,
        errorCode: code,
      });

      job.emitComplete({
        user,
        imageId,
        themeId,
        jobId,
        status: "failed",
        error: userMessage,
        errorCode: code,
      });

      logAiAnalyticsEvent(baseDir, {
        type: "generate_failed",
        user,
        imageId,
        themeId,
        jobId,
        durationMs: Date.now() - startedAt,
        errorCode: code,
      });
    }
  }

  getStats() {
    return {
      queued: this.queue.length,
      active: this.activeCount,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

/** @type {AiGenerationQueue | null} */
let singleton = null;

export function getAiGenerationQueue() {
  if (!singleton) {
    singleton = new AiGenerationQueue();
  }
  return singleton;
}

/**
 * @param {{
 *   user: string,
 *   userDir: string,
 *   imageId: string,
 *   themeId: string,
 *   todayFolder: string,
 *   host: string,
 *   emitProgress: (payload: Record<string, unknown>) => void,
 *   emitComplete: (payload: Record<string, unknown>) => void,
 * }} params
 */
export function enqueueAiGenerationJob(params) {
  const jobId = buildAiJobId(params.imageId, params.themeId);
  getAiGenerationQueue().enqueue({ ...params, jobId });
  return jobId;
}

export function getAiQueueStats() {
  return getAiGenerationQueue().getStats();
}
