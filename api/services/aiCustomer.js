import fs from "fs";
import path from "path";
import { readCustomerJson } from "./customerConfig.js";
import {
  normalizePackageType,
  readAiQuotaFromCustomer,
} from "./packageTypes.js";
import { getAiTheme } from "./aiThemes.js";

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

  if (normalizePackageType(data.packageType) !== "ai-self-photo") {
    throw new Error("package_not_ai");
  }

  if (data.aiThemeLockedAt) throw new Error("theme_locked");
  if ((Number(data.aiGenerateUsed) || 0) > 0) throw new Error("theme_locked");
  if (countActiveAiJobs(data) > 0) throw new Error("theme_locked");

  const theme = getAiTheme(themeId);
  if (!theme) throw new Error("invalid_theme");

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
