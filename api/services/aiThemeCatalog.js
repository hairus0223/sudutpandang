import fs from "fs";
import path from "path";
import { resolveBaseDir } from "./studioPaths.js";

/** @typedef {{
 *   id: string,
 *   label: string,
 *   description: string,
 *   transformPrompt: string,
 *   negativePrompt: string,
 *   previewColor: string,
 *   backgroundThemeId?: string,
 *   publishedAt?: string,
 * }} AiTheme */

const WILD_WEST_TRANSFORM_PROMPT = [
  "Transform the provided photo into a highly realistic Wild West cowboy portrait while preserving the person's exact identity.",
  "IDENTITY LOCK (highest priority): Keep the exact same person — facial features, face shape, skin tone, hairstyle, expression, eye direction, body proportions, pose, hand positions, camera angle, and full-body framing identical to the source photo.",
  "WARDROBE REPLACEMENT ONLY: Remove the original outfit completely. Dress the subject in authentic 19th-century cowboy attire: a weathered brown leather cowboy hat, brown suede leather jacket with subtle fringe on chest and sleeves, muted plaid western shirt, classic worn blue denim jeans, leather belt with large antique oval buckle, brown leather cowboy boots, and worn leather gloves.",
  "Add tasteful Western accessories: neck bandana, leather gun belt with holstered revolver, and coiled rope on the belt — subtle, not overpowering.",
  "Do not change the background in this step — costume and material textures only. Photorealistic fabric and leather, natural skin texture, sharp focus. The subject must look like the same person from the original photo.",
].join("\n\n");

const WILD_WEST_NEGATIVE_PROMPT = [
  "different person, face swap, changed pose, altered expression, different body proportions,",
  "turned head, different hand position, reposed subject, younger face, older face,",
  "background change, studio backdrop removal, outdoor scene generation,",
  "cartoon, anime, painting, CGI, illustration, fantasy armor, exaggerated muscles,",
  "distorted face, different identity, low quality, blurry, oversaturated,",
  "duplicate face, extra limbs, bad anatomy, unrealistic skin, plastic texture,",
  "modern fashion clothing, ribbed shirt, sandals, sneakers",
].join(" ");

/** @type {AiTheme[]} */
export const BUNDLED_AI_THEMES = [
  {
    id: "wild-west",
    label: "Wild West",
    description: "Potret koboi sinematik — kostum & suasana Western",
    transformPrompt: WILD_WEST_TRANSFORM_PROMPT,
    negativePrompt: WILD_WEST_NEGATIVE_PROMPT,
    previewColor: "#A67B5B",
    backgroundThemeId: "wild-west",
  },
];

/** @type {{ themes: AiTheme[], mtime: number, path: string | null } | null} */
let cachedDiskCatalog = null;

/**
 * @param {unknown} raw
 * @returns {AiTheme | null}
 */
function normalizeThemeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const entry = /** @type {Record<string, unknown>} */ (raw);
  const id = String(entry.id ?? "").trim();
  const transformPrompt = String(entry.transformPrompt ?? "").trim();
  const negativePrompt = String(entry.negativePrompt ?? "").trim();
  const label = String(entry.label ?? "").trim();
  const description = String(entry.description ?? "").trim();
  const previewColor = String(entry.previewColor ?? "#888888").trim();
  const backgroundThemeId = String(entry.backgroundThemeId ?? entry.id ?? "").trim() || id;

  if (!id || !transformPrompt || !negativePrompt || !label) {
    return null;
  }

  return {
    id,
    label,
    description: description || label,
    transformPrompt,
    negativePrompt,
    previewColor,
    backgroundThemeId,
    ...(typeof entry.publishedAt === "string" ? { publishedAt: entry.publishedAt } : {}),
  };
}

/**
 * @param {string} baseDir
 * @returns {string}
 */
export function getCatalogConfigPath(baseDir = resolveBaseDir()) {
  return path.join(baseDir, "config", "ai-themes.json");
}

/** Clear in-memory catalog cache after publish. */
export function invalidateThemeCatalogCache() {
  cachedDiskCatalog = null;
}

/**
 * @param {string} baseDir
 * @returns {{ version: number, themes: AiTheme[] }}
 */
function readCatalogFile(baseDir) {
  const configPath = getCatalogConfigPath(baseDir);
  if (!fs.existsSync(configPath)) {
    return { version: 1, themes: [] };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const themes = Array.isArray(raw.themes)
      ? raw.themes.map(normalizeThemeEntry).filter(Boolean)
      : [];
    return {
      version: typeof raw.version === "number" ? raw.version : 1,
      themes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid_catalog:${message}`);
  }
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isValidThemeId(id) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

/**
 * Publish or update a theme in the studio catalog on disk.
 * Bundled themes (e.g. wild-west) are overridden when the same id is published.
 * @param {string} baseDir
 * @param {AiTheme} theme
 * @returns {AiTheme}
 */
export function publishThemeToCatalog(baseDir, theme) {
  if (!isValidThemeId(theme.id)) {
    throw new Error("invalid_theme_id");
  }

  const normalized = normalizeThemeEntry(theme);
  if (!normalized) {
    throw new Error("invalid_theme_payload");
  }

  const configPath = getCatalogConfigPath(baseDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  const catalog = readCatalogFile(baseDir);
  const idx = catalog.themes.findIndex((entry) => entry.id === normalized.id);
  const published = {
    ...normalized,
    publishedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    catalog.themes[idx] = published;
  } else {
    catalog.themes.push(published);
  }

  fs.writeFileSync(
    configPath,
    JSON.stringify({ version: catalog.version, themes: catalog.themes }, null, 2)
  );
  invalidateThemeCatalogCache();
  return published;
}

/**
 * @param {string} baseDir
 * @returns {AiTheme[]}
 */
function loadDiskThemes(baseDir) {
  const configPath = path.join(baseDir, "config", "ai-themes.json");

  try {
    if (!fs.existsSync(configPath)) {
      cachedDiskCatalog = { themes: [], mtime: 0, path: null };
      return [];
    }

    const stat = fs.statSync(configPath);
    if (
      cachedDiskCatalog &&
      cachedDiskCatalog.path === configPath &&
      cachedDiskCatalog.mtime === stat.mtimeMs
    ) {
      return cachedDiskCatalog.themes;
    }

    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const themes = Array.isArray(raw.themes)
      ? raw.themes.map(normalizeThemeEntry).filter(Boolean)
      : [];

    cachedDiskCatalog = { themes, mtime: stat.mtimeMs, path: configPath };
    return themes;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ai-themes] failed to load ${configPath}:`, message);
    return cachedDiskCatalog?.themes ?? [];
  }
}

/**
 * Merge bundled defaults with optional studio catalog on disk.
 * Disk entries override bundled fields by id; disk-only ids are appended.
 * @param {string} [baseDir]
 * @returns {AiTheme[]}
 */
export function getActiveAiThemes(baseDir = resolveBaseDir()) {
  const diskThemes = loadDiskThemes(baseDir);
  const byId = new Map(BUNDLED_AI_THEMES.map((theme) => [theme.id, { ...theme }]));

  for (const diskTheme of diskThemes) {
    const existing = byId.get(diskTheme.id);
    byId.set(diskTheme.id, existing ? { ...existing, ...diskTheme } : diskTheme);
  }

  return [...byId.values()];
}

/**
 * @param {string} [baseDir]
 * @returns {Map<string, AiTheme>}
 */
export function getActiveAiThemeMap(baseDir = resolveBaseDir()) {
  return new Map(getActiveAiThemes(baseDir).map((theme) => [theme.id, theme]));
}
