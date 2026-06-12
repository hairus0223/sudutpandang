import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getThemeAssetSvg, THEME_ASSET_SIZE } from "./themeAssetSvgs.js";
import {
  getThemeCategoryAssetsDir,
  getThemeCategoryDef,
  listThemeCategoryDefs,
  listThemeCategoryDefsByKind,
} from "./themeCategories.js";
import { getThemeAssetPath, getThemePreset } from "./themePresets.js";

/**
 * @param {string} themeId
 * @returns {Promise<{ themeId: string, filename: string, bytes: number, skipped?: boolean, reason?: string }>}
 */
async function generateSingleThemeAsset(themeId) {
  const preset = getThemePreset(themeId);
  const svg = getThemeAssetSvg(themeId);
  const outputDir = getThemeCategoryAssetsDir(preset.category);

  if (!outputDir) {
    return {
      themeId,
      filename: preset.assetFilename ?? themeId,
      bytes: 0,
      skipped: true,
      reason: "unknown_category",
    };
  }

  if (!svg || !preset.assetFilename) {
    return {
      themeId,
      filename: preset.assetFilename ?? themeId,
      bytes: 0,
      skipped: true,
      reason: "no_svg_template",
    };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, preset.assetFilename);

  await sharp(Buffer.from(svg))
    .resize(THEME_ASSET_SIZE.width, THEME_ASSET_SIZE.height)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  const stat = fs.statSync(outputPath);

  return {
    themeId,
    filename: preset.assetFilename,
    bytes: stat.size,
  };
}

/**
 * @param {string} categoryId
 */
export async function generateCategoryThemeAssets(categoryId) {
  const def = getThemeCategoryDef(categoryId);
  if (!def) {
    throw new Error(`Unknown theme category: ${categoryId}`);
  }

  const outputDir = getThemeCategoryAssetsDir(categoryId);
  if (!outputDir) {
    throw new Error(`No assets directory for category: ${categoryId}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  /** @type {Awaited<ReturnType<typeof generateSingleThemeAsset>>[]} */
  const results = [];

  for (const themeId of def.themeIds) {
    results.push(await generateSingleThemeAsset(themeId));
  }

  return {
    categoryId,
    label: def.label,
    outputDir,
    results,
  };
}

/**
 * @param {{ eventOnly?: boolean, categoryId?: string }} [options]
 */
export async function generateThemeAssets(options = {}) {
  let categories = listThemeCategoryDefs();

  if (options.categoryId) {
    const def = getThemeCategoryDef(options.categoryId);
    if (!def) {
      throw new Error(`Unknown theme category: ${options.categoryId}`);
    }
    categories = [def];
  } else if (options.eventOnly) {
    categories = listThemeCategoryDefsByKind("event");
  }

  const batches = [];

  for (const category of categories) {
    batches.push(await generateCategoryThemeAssets(category.id));
  }

  return batches;
}

/**
 * @param {string} categoryId
 */
export function validateCategoryThemeAssets(categoryId) {
  const def = getThemeCategoryDef(categoryId);
  if (!def) {
    throw new Error(`Unknown theme category: ${categoryId}`);
  }

  const dir = getThemeCategoryAssetsDir(categoryId);
  /** @type {string[]} */
  const missing = [];

  for (const themeId of def.themeIds) {
    const preset = getThemePreset(themeId);
    if (!getThemeAssetPath(preset)) {
      missing.push(themeId);
    }
  }

  return {
    categoryId,
    label: def.label,
    kind: def.kind,
    dir,
    themeCount: def.themeIds.length,
    missing,
    assetsReady: missing.length === 0,
  };
}

/**
 * @param {{ eventOnly?: boolean, categoryId?: string }} [options]
 */
export function validateThemeAssets(options = {}) {
  let categories = listThemeCategoryDefs();

  if (options.categoryId) {
    const def = getThemeCategoryDef(options.categoryId);
    if (!def) {
      throw new Error(`Unknown theme category: ${options.categoryId}`);
    }
    categories = [def];
  } else if (options.eventOnly) {
    categories = listThemeCategoryDefsByKind("event");
  }

  const reports = categories.map((category) =>
    validateCategoryThemeAssets(category.id)
  );

  const missing = reports.flatMap((report) => report.missing);

  return {
    ok: missing.length === 0,
    missing,
    categories: reports,
    eventCategoriesReady: reports
      .filter((report) => report.kind === "event")
      .every((report) => report.assetsReady),
  };
}
