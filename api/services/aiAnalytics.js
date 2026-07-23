import fs from "fs";
import path from "path";
import { resolveBaseDir } from "./studioPaths.js";

/**
 * @typedef {"generate_started" | "generate_success" | "generate_failed" | "theme_selected" | "openai_usage"} AiAnalyticsEventType
 */

/**
 * @param {string} [baseDir]
 * @returns {string}
 */
function getAnalyticsPath(baseDir) {
  const root = baseDir || resolveBaseDir();
  const dir = path.join(root, "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "ai-analytics.jsonl");
}

/**
 * @param {string} [baseDir]
 * @param {Record<string, unknown>} event
 */
export function logAiAnalyticsEvent(baseDir, event) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...event,
    });
    fs.appendFileSync(getAnalyticsPath(baseDir), `${line}\n`, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[ai-analytics] write failed:", message);
  }
}

/**
 * @param {string} line
 * @returns {Record<string, unknown> | null}
 */
function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * @param {string} [baseDir]
 * @param {{ days?: number }} [options]
 */
export function getAiAnalyticsSummary(baseDir, options = {}) {
  const days = Math.max(1, Math.min(365, Number(options.days) || 30));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filePath = getAnalyticsPath(baseDir);

  if (!fs.existsSync(filePath)) {
    return {
      days,
      totalEvents: 0,
      generatesStarted: 0,
      generatesSuccess: 0,
      generatesFailed: 0,
      successRate: null,
      themeSelected: {},
      themeGenerated: {},
      themeSuccess: {},
      themeFailed: {},
    };
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter(Boolean);

  let generatesStarted = 0;
  let generatesSuccess = 0;
  let generatesFailed = 0;
  /** @type {Record<string, number>} */
  const themeSelected = {};
  /** @type {Record<string, number>} */
  const themeGenerated = {};
  /** @type {Record<string, number>} */
  const themeSuccess = {};
  /** @type {Record<string, number>} */
  const themeFailed = {};

  for (const line of lines) {
    const event = parseLine(line);
    if (!event?.ts || typeof event.ts !== "string") continue;
    const ts = new Date(event.ts).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;

    const type = String(event.type ?? "");
    const themeId = event.themeId ? String(event.themeId) : null;

    if (type === "generate_started") {
      generatesStarted += 1;
      if (themeId) themeGenerated[themeId] = (themeGenerated[themeId] ?? 0) + 1;
    } else if (type === "generate_success") {
      generatesSuccess += 1;
      if (themeId) themeSuccess[themeId] = (themeSuccess[themeId] ?? 0) + 1;
    } else if (type === "generate_failed") {
      generatesFailed += 1;
      if (themeId) themeFailed[themeId] = (themeFailed[themeId] ?? 0) + 1;
    } else if (type === "theme_selected" && themeId) {
      themeSelected[themeId] = (themeSelected[themeId] ?? 0) + 1;
    }
  }

  const finished = generatesSuccess + generatesFailed;
  const successRate = finished > 0 ? generatesSuccess / finished : null;

  /** @type {Array<{ themeId: string, count: number }>} */
  const popularThemes = Object.entries(themeGenerated)
    .map(([themeId, count]) => ({ themeId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    days,
    totalEvents: lines.length,
    generatesStarted,
    generatesSuccess,
    generatesFailed,
    successRate,
    themeSelected,
    themeGenerated,
    themeSuccess,
    themeFailed,
    popularThemes,
  };
}

/**
 * @param {string} [baseDir]
 * @param {{ days?: number, source?: string | null }} [options]
 */
export function getAiCostSummary(baseDir, options = {}) {
  const days = Math.max(1, Math.min(365, Number(options.days) || 30));
  const sourceFilter = options.source ? String(options.source) : null;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filePath = getAnalyticsPath(baseDir);

  /** @type {Record<string, { calls: number, costUsd: number }>} */
  const bySource = {};
  /** @type {Record<string, { calls: number, costUsd: number }>} */
  const byDay = {};
  /** @type {Record<string, { calls: number, costUsd: number }>} */
  const byTier = {};

  let totalCalls = 0;
  let totalCostUsd = 0;
  let galleryCostUsd = 0;
  let researchCostUsd = 0;

  if (!fs.existsSync(filePath)) {
    return {
      days,
      source: sourceFilter,
      totalCalls: 0,
      totalCostUsd: 0,
      galleryCostUsd: 0,
      researchCostUsd: 0,
      bySource: {},
      byDay: {},
      byTier: {},
    };
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter(Boolean);

  for (const line of lines) {
    const event = parseLine(line);
    if (!event?.ts || typeof event.ts !== "string") continue;
    const ts = new Date(event.ts).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    if (String(event.type ?? "") !== "openai_usage") continue;

    const source = String(event.source ?? "unknown");
    if (sourceFilter && source !== sourceFilter) continue;

    const costUsd = Number(event.costUsd) || 0;
    const tier = String(event.tier ?? "unknown");
    const day = String(event.ts).slice(0, 10);

    totalCalls += 1;
    totalCostUsd += costUsd;
    if (source === "gallery") galleryCostUsd += costUsd;
    if (source === "research") researchCostUsd += costUsd;

    if (!bySource[source]) bySource[source] = { calls: 0, costUsd: 0 };
    bySource[source].calls += 1;
    bySource[source].costUsd += costUsd;

    if (!byDay[day]) byDay[day] = { calls: 0, costUsd: 0 };
    byDay[day].calls += 1;
    byDay[day].costUsd += costUsd;

    if (!byTier[tier]) byTier[tier] = { calls: 0, costUsd: 0 };
    byTier[tier].calls += 1;
    byTier[tier].costUsd += costUsd;
  }

  for (const bucket of [bySource, byDay, byTier]) {
    for (const key of Object.keys(bucket)) {
      bucket[key].costUsd = Math.round(bucket[key].costUsd * 10000) / 10000;
    }
  }

  return {
    days,
    source: sourceFilter,
    totalCalls,
    totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    galleryCostUsd: Math.round(galleryCostUsd * 10000) / 10000,
    researchCostUsd: Math.round(researchCostUsd * 10000) / 10000,
    bySource,
    byDay,
    byTier,
  };
}
