import fs from "fs";
import { BG_REMOVAL_ENABLED, getRemovalModel } from "./backgroundRemoval.js";
import { THEME_GENERATION_ENABLED } from "./themeGeneration.js";
import { getThemeApiStatus } from "./themeApiAdapter.js";
import { getThemeCacheStatus } from "./themeBackgroundCache.js";
import {
  listThemeCategoriesForApi,
  resolveDefaultThemeId,
  validateAllBundledThemeAssets,
  validateClassicThemeAssets,
  validateWorldCupThemeAssets,
} from "./themePresets.js";

/**
 * @param {object} params
 * @param {string} params.baseDir
 * @param {string} params.publicHost
 * @param {number} params.port
 */
export function validateStudioConfig({ baseDir, publicHost, port }) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const errors = [];

  if (!process.env.API_PUBLIC_HOST) {
    warnings.push(
      "API_PUBLIC_HOST tidak diset — URL gambar memakai Host header request (bisa gagal di kiosk/gallery LAN)."
    );
  }

  const hostLower = String(publicHost).toLowerCase();
  if (hostLower.startsWith("localhost") || hostLower.startsWith("127.0.0.1")) {
    warnings.push(
      "API_PUBLIC_HOST masih localhost — set IP LAN studio (contoh: 192.168.1.10:4000) untuk production."
    );
  }

  if (!fs.existsSync(baseDir)) {
    warnings.push(`BASE_DIR belum ada dan akan dibuat: ${baseDir}`);
  }

  const themeApi = getThemeApiStatus();
  const themeApiUrl = process.env.THEME_API_URL?.trim();
  const themeApiKey = process.env.THEME_API_KEY?.trim();
  if (themeApiUrl && !themeApiKey) {
    warnings.push("THEME_API_URL diset tanpa THEME_API_KEY — API tema eksternal tidak akan dipakai.");
  }
  if (themeApiKey && !themeApiUrl) {
    warnings.push("THEME_API_KEY diset tanpa THEME_API_URL — kunci tema eksternal diabaikan.");
  }
  if (themeApi.configured && process.env.THEME_API_CACHE_ENABLED === "false") {
    warnings.push("THEME_API_CACHE_ENABLED=false — hasil API eksternal tidak di-cache ke disk.");
  }

  const wcAssets = validateWorldCupThemeAssets();
  if (wcAssets.missing.length > 0) {
    warnings.push(
      `Asset WC2026 belum lengkap (${wcAssets.missing.length}) — jalankan: npm run generate:wc2026-assets`
    );
  }

  const classicAssets = validateClassicThemeAssets();
  if (classicAssets.missing.length > 0) {
    warnings.push(
      `Asset classic belum lengkap (${classicAssets.missing.length}) — jalankan: npm run generate:theme-assets -- --category classic`
    );
  }

  const allAssets = validateAllBundledThemeAssets();
  const incompleteEvents = (allAssets.categories ?? []).filter(
    (category) => category.kind === "event" && !category.assetsReady
  );
  if (incompleteEvents.length > 0) {
    warnings.push(
      `Asset event belum lengkap (${incompleteEvents.map((c) => c.label).join(", ")}) — jalankan: npm run event:preflight`
    );
  }

  if (!BG_REMOVAL_ENABLED) {
    warnings.push("BG_REMOVAL_ENABLED=false — hapus background otomatis dimatikan.");
  }

  if (!THEME_GENERATION_ENABLED) {
    warnings.push("THEME_GENERATION_ENABLED=false — komposit tema AI dimatikan.");
  }

  const portNum = Number(port);
  if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
    errors.push(`PORT tidak valid: ${port}`);
  }

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    wc2026Assets: wcAssets,
    classicAssets,
    themeAssets: validateAllBundledThemeAssets(),
  };
}

/**
 * Safe config snapshot for health endpoints (no secrets).
 * @param {object} params
 * @param {string} params.baseDir
 * @param {string} params.publicHost
 * @param {number} params.port
 */
export function getPublicStudioConfig({ baseDir, publicHost, port }) {
  const wcAssets = validateWorldCupThemeAssets();
  const classicAssets = validateClassicThemeAssets();
  const allAssets = validateAllBundledThemeAssets();
  const themeApi = getThemeApiStatus();
  const themeCache = getThemeCacheStatus();
  const eventAssetsReady = (allAssets.categories ?? [])
    .filter((category) => category.kind === "event")
    .every((category) => category.assetsReady);

  return {
    port,
    publicHost,
    baseDir,
    bgRemovalEnabled: BG_REMOVAL_ENABLED,
    bgRemovalModel: getRemovalModel(),
    themeGenerationEnabled: THEME_GENERATION_ENABLED,
    defaultThemeId: resolveDefaultThemeId(),
    uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES) || 20 * 1024 * 1024,
    imageProcessMinIntervalMs:
      Number(process.env.IMAGE_PROCESS_MIN_INTERVAL_MS) || 2000,
    imageProcessMaxJobsPerUser:
      Number(process.env.IMAGE_PROCESS_MAX_JOBS_PER_USER) || 3,
    wc2026AssetsReady: wcAssets.missing.length === 0,
    classicAssetsReady: classicAssets.missing.length === 0,
    bundledThemeAssetsReady:
      wcAssets.missing.length === 0 && classicAssets.missing.length === 0,
    eventThemeAssetsReady: eventAssetsReady,
    themeCategories: listThemeCategoriesForApi(),
    externalThemeApiConfigured: themeApi.configured,
    externalThemeApiProvider: themeApi.provider,
    themeBackgroundCache: themeCache,
  };
}

/**
 * @param {object} params
 * @param {{ ok: boolean, warnings: string[], errors: string[] }} params.validation
 * @param {ReturnType<typeof getPublicStudioConfig>} params.config
 */
export function logStartupValidation({ validation, config }) {
  if (validation.errors.length > 0) {
    for (const message of validation.errors) {
      console.error(`[studio-config] ERROR: ${message}`);
    }
  }

  for (const message of validation.warnings) {
    console.warn(`[studio-config] ${message}`);
  }

  console.log(
    `[studio-config] publicHost=${config.publicHost} theme=${config.defaultThemeId} event=${config.eventThemeAssetsReady ? "OK" : "MISSING"} bundled=${config.bundledThemeAssetsReady ? "OK" : "MISSING"} themeApi=${config.externalThemeApiConfigured ? config.externalThemeApiProvider : "off"}`
  );
}
