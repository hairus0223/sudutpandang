import fs from "fs";
import path from "path";
import { readCustomerJson, readCustomerPackageType } from "./customerConfig.js";
import {
  normalizePackageType,
  readAiQuotaFromCustomer,
  usesSessionTheme,
} from "./packageTypes.js";
import { getAiTheme } from "./aiThemes.js";
import { isThemeSelectableForRegister } from "./aiThemeProduction.js";

export const INCOMPLETE_AI_STATUSES = ["pending", "queued", "processing"];

export const AI_JOB_INTERRUPTED_MESSAGE =
  "Job terputus karena server restart. Coba edit lagi.";

/**
 * Theme chosen at register. Gallery cannot replace it with another theme.
 * @param {string | undefined | null} rawThemeId
 * @param {string} [baseDir]
 */
export function resolveAiRegisterTheme(rawThemeId, baseDir) {
  const theme = getAiTheme(rawThemeId, baseDir);
  if (!theme) {
    throw new Error("theme_required");
  }
  if (!isThemeSelectableForRegister(theme, baseDir)) {
    throw new Error("theme_not_ready");
  }
  return theme;
}

/**
 * @param {string} userFolder
 * @param {Record<string, unknown>} data
 */
export function writeCustomerJson(userFolder, data) {
  fs.writeFileSync(
    path.join(userFolder, "customer.json"),
    JSON.stringify(data, null, 2)
  );
}

/**
 * @param {Record<string, unknown> | null | undefined} customer
 * @returns {Array<Record<string, unknown>>}
 */
export function getAiSelections(customer) {
  return Array.isArray(customer?.aiSelections) ? customer.aiSelections : [];
}

/**
 * @param {Record<string, unknown> | null | undefined} customer
 * @returns {{ themeId: string | null, label: string | null, locked: boolean, lockedAt: string | null }}
 */
export function readSessionTheme(customer) {
  const themeId = customer?.aiThemeId ? String(customer.aiThemeId) : null;
  const theme = themeId ? getAiTheme(themeId) : null;
  const lockedAt = customer?.aiThemeLockedAt
    ? String(customer.aiThemeLockedAt)
    : null;

  return {
    themeId: theme?.id ?? themeId,
    label: theme?.label ?? null,
    locked: Boolean(lockedAt),
    lockedAt,
  };
}

/**
 * @param {string} userFolder
 * @param {string} themeId
 */
export function setSessionTheme(userFolder, themeId) {
  const data = readCustomerJson(userFolder);
  if (!data) throw new Error("customer_not_found");

  if (!usesSessionTheme(normalizePackageType(data.packageType))) {
    throw new Error("package_not_themed");
  }

  if (data.aiThemeLockedAt) throw new Error("theme_locked");
  if ((Number(data.aiGenerateUsed) || 0) > 0) throw new Error("theme_locked");
  if (countActiveAiJobs(data) > 0) throw new Error("theme_locked");
  if (data.aiThemeId && String(data.aiThemeId) !== String(themeId).trim()) {
    throw new Error("theme_locked");
  }

  const theme = getAiTheme(themeId);
  if (!theme) throw new Error("invalid_theme");
  if (!isThemeSelectableForRegister(theme)) {
    throw new Error("theme_not_ready");
  }

  data.aiThemeId = theme.id;
  writeCustomerJson(userFolder, data);

  return {
    themeId: theme.id,
    label: theme.label,
    locked: false,
    lockedAt: null,
  };
}

/**
 * @param {string} userFolder
 */
export function lockSessionTheme(userFolder) {
  const data = readCustomerJson(userFolder);
  if (!data || data.aiThemeLockedAt) return null;

  data.aiThemeLockedAt = new Date().toISOString();
  writeCustomerJson(userFolder, data);
  return data.aiThemeLockedAt;
}

/**
 * @param {Record<string, unknown> | null | undefined} customer
 * @param {string} imageId
 * @returns {Record<string, unknown> | undefined}
 */
export function findAiSelectionForImage(customer, imageId) {
  return getAiSelections(customer).find(
    (entry) => String(entry.imageId) === String(imageId)
  );
}

/**
 * @param {Record<string, unknown> | null | undefined} customer
 * @param {string} imageId
 * @param {string} themeId
 * @returns {Record<string, unknown> | undefined}
 */
export function findAiSelection(customer, imageId, themeId) {
  const entry = findAiSelectionForImage(customer, imageId);
  if (!entry) return undefined;
  if (themeId && entry.themeId && entry.themeId !== themeId) return undefined;
  return entry;
}

/**
 * @param {Record<string, unknown> | null | undefined} customer
 * @returns {number}
 */
export function countActiveAiJobs(customer) {
  return getAiSelections(customer).filter((entry) =>
    ["pending", "processing", "queued"].includes(String(entry.status))
  ).length;
}

/**
 * @param {string} userFolder
 * @returns {{ limit: number, used: number, remaining: number, pending: number, available: number }}
 */
export function readAiQuotaWithPending(userFolder) {
  const data = readCustomerJson(userFolder);
  const base = readAiQuotaFromCustomer(data);
  const pending = countActiveAiJobs(data);
  return {
    ...base,
    pending,
    available: Math.max(0, base.remaining - pending),
  };
}

/**
 * Reserve one AI generate slot when a job is accepted.
 * @param {string} userFolder
 */
export function reserveAiQuota(userFolder) {
  const data = readCustomerJson(userFolder);
  if (!data) throw new Error("customer_not_found");

  const packageType = normalizePackageType(data.packageType);
  if (packageType !== "ai-self-photo") throw new Error("package_not_ai");

  const quota = readAiQuotaWithPending(userFolder);
  if (quota.available <= 0) throw new Error("quota_exhausted");

  data.aiGenerateUsed = Math.max(0, Number(data.aiGenerateUsed) || 0) + 1;
  writeCustomerJson(userFolder, data);
  return readAiQuotaFromCustomer(data);
}

/**
 * Release a reserved slot when generation fails.
 * @param {string} userFolder
 */
export function releaseAiQuota(userFolder) {
  const data = readCustomerJson(userFolder);
  if (!data) return null;

  data.aiGenerateUsed = Math.max(0, (Number(data.aiGenerateUsed) || 0) - 1);
  writeCustomerJson(userFolder, data);
  return readAiQuotaFromCustomer(data);
}

/**
 * @param {string} userFolder
 * @param {Record<string, unknown>} selection
 */
export function upsertAiSelection(userFolder, selection) {
  const data = readCustomerJson(userFolder);
  if (!data) throw new Error("customer_not_found");

  const selections = getAiSelections(data);
  const imageId = String(selection.imageId);
  const sessionTheme = readSessionTheme(data);
  const themeId = String(selection.themeId || sessionTheme.themeId || "");
  const idx = selections.findIndex((entry) => String(entry.imageId) === imageId);

  const now = new Date().toISOString();
  const entry = {
    ...(idx >= 0 ? selections[idx] : {}),
    ...selection,
    imageId,
    themeId,
    updatedAt: now,
  };

  if (idx >= 0) {
    selections[idx] = entry;
  } else {
    selections.push({ ...entry, createdAt: now });
  }

  data.aiSelections = selections;
  writeCustomerJson(userFolder, data);
  return entry;
}

/**
 * @param {string} userFolder
 * @param {string} jobId
 * @returns {Record<string, unknown> | undefined}
 */
export function findAiSelectionByJobId(userFolder, jobId) {
  const data = readCustomerJson(userFolder);
  return getAiSelections(data).find((entry) => entry.jobId === jobId);
}

/**
 * Incomplete AI jobs on disk (queued/processing after an API crash).
 * @param {string} baseDir
 * @param {string} todayFolder
 * @returns {Array<{ userDir: string, user: string, imageId: string, themeId: string, jobId: string | null }>}
 */
export function findIncompleteAiJobs(baseDir, todayFolder) {
  const dayPath = path.join(baseDir, todayFolder);
  if (!fs.existsSync(dayPath)) return [];

  /** @type {Array<{ userDir: string, user: string, imageId: string, themeId: string, jobId: string | null }>} */
  const jobs = [];

  for (const userSlug of fs.readdirSync(dayPath)) {
    const userDir = path.join(dayPath, userSlug);
    try {
      if (!fs.statSync(userDir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (readCustomerPackageType(userDir) !== "ai-self-photo") continue;

    const customer = readCustomerJson(userDir);
    if (!customer) continue;

    for (const entry of getAiSelections(customer)) {
      if (!INCOMPLETE_AI_STATUSES.includes(String(entry.status))) continue;
      const imageId = String(entry.imageId || "").trim();
      if (!imageId) continue;
      jobs.push({
        userDir,
        user: userSlug,
        imageId,
        themeId: String(entry.themeId || customer.aiThemeId || ""),
        jobId: entry.jobId ? String(entry.jobId) : null,
      });
    }
  }

  return jobs;
}

/**
 * After API restart, mark stuck jobs failed and release quota so operators can retry.
 * OpenAI work is not resumable; leaving status=processing would block generate forever.
 *
 * @param {{
 *   baseDir: string,
 *   todayFolder: string,
 *   io?: { emit: (event: string, payload: Record<string, unknown>) => void } | null,
 * }} params
 */
export function recoverIncompleteAiJobs({ baseDir, todayFolder, io = null }) {
  const jobs = findIncompleteAiJobs(baseDir, todayFolder);

  for (const job of jobs) {
    releaseAiQuota(job.userDir);
    upsertAiSelection(job.userDir, {
      imageId: job.imageId,
      themeId: job.themeId,
      jobId: job.jobId,
      status: "failed",
      phase: null,
      error: AI_JOB_INTERRUPTED_MESSAGE,
      errorCode: "job_interrupted",
    });

    io?.emit("ai-generation-complete", {
      user: job.user,
      imageId: job.imageId,
      themeId: job.themeId,
      jobId: job.jobId,
      status: "failed",
      error: AI_JOB_INTERRUPTED_MESSAGE,
      errorCode: "job_interrupted",
    });
  }

  if (jobs.length > 0) {
    console.log(
      `[ai] recovered ${jobs.length} incomplete job(s) as failed (quota released)`
    );
  }

  return jobs;
}
