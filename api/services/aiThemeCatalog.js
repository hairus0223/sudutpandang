import fs from "fs";
import path from "path";
import { resolveBaseDir } from "./studioPaths.js";

/** @typedef {"direct" | "composite-only" | "composite-costume"} AiPipelineMode */

/** @typedef {{
 *   id: string,
 *   label: string,
 *   description: string,
 *   transformPrompt: string,
 *   negativePrompt: string,
 *   costumePrompt?: string,
 *   costumeNegativePrompt?: string,
 *   previewColor: string,
 *   backgroundThemeId?: string,
 *   pipelineMode?: AiPipelineMode,
 *   backgroundRequired?: boolean,
 *   lookId?: string | null,
 *   placement?: { scale?: number, yOffset?: number },
 *   overlays?: Array<{ file: string, blend?: string, opacity?: number }>,
 *   publishedAt?: string,
 * }} AiTheme */

export const AI_PIPELINE_MODES = [
  "direct",
  "composite-only",
  "composite-costume",
];

const DEFAULT_PIPELINE_MODE =
  (process.env.AI_DEFAULT_PIPELINE_MODE || "composite-costume").trim();

/** @type {Pick<AiTheme, "pipelineMode" | "backgroundRequired" | "lookId" | "placement" | "overlays">} */
export const BOOTH_THEME_DEFAULTS = {
  pipelineMode: "composite-costume",
  backgroundRequired: true,
  lookId: "warm",
  placement: { scale: 0.94, yOffset: 0.03 },
  overlays: [{ file: "frame.png", blend: "over", opacity: 0.82 }],
};

const IDENTITY_LOCK = [
  "IDENTITY LOCK (highest priority): Keep the exact same person — facial features, face shape, skin tone, hairstyle, expression, eye direction, body proportions, pose, hand positions, camera angle, and full-body framing identical to the source photo.",
  "The subject must look like the same person from the original photo — photorealistic skin texture, sharp focus, natural lighting on the face.",
].join("\n\n");

const SHARED_NEGATIVE = [
  "different person, face swap, changed pose, altered expression, different body proportions,",
  "turned head, different hand position, reposed subject, younger face, older face,",
  "cartoon unless requested, distorted face, different identity, low quality, blurry, oversaturated,",
  "duplicate face, extra limbs, bad anatomy, unrealistic skin, plastic texture,",
  "text, watermark, logo, frame border",
].join(" ");

/**
 * @param {string} sceneAndWardrobe
 * @param {string} [extraNegative]
 */
function buildTransformPrompt(sceneAndWardrobe, extraNegative = "") {
  return [
    `Transform the provided photo into a highly realistic themed portrait while preserving the person's exact identity.`,
    IDENTITY_LOCK,
    sceneAndWardrobe,
  ].join("\n\n");
}

/**
 * @param {string} [extra]
 */
function buildNegativePrompt(extra = "") {
  return extra ? `${SHARED_NEGATIVE} ${extra}`.trim() : SHARED_NEGATIVE;
}

const COSTUME_ONLY_PREFIX = [
  "Replace clothing and visible accessories on the subject only.",
  "Do NOT change the background, studio backdrop, environment, scenery, or global lighting.",
  IDENTITY_LOCK,
].join("\n\n");

/**
 * @param {string} wardrobe
 */
function buildCostumePrompt(wardrobe) {
  return [
    COSTUME_ONLY_PREFIX,
    wardrobe,
    "Photorealistic fabric and material textures. Same pose, hands, face, and hair.",
  ].join("\n\n");
}

/**
 * @param {string} [extra]
 */
function buildCostumeNegative(extra = "") {
  return buildNegativePrompt(
    `background change, scene change, outdoor environment, environment replacement, studio backdrop change, ${extra}`.trim()
  );
}

export { buildCostumePrompt, buildCostumeNegative };

/**
 * @param {AiTheme} theme
 * @returns {string}
 */
export function getThemeCostumePrompt(theme) {
  return String(theme.costumePrompt ?? theme.transformPrompt ?? "").trim();
}

/**
 * @param {AiTheme} theme
 * @returns {string}
 */
export function getThemeCostumeNegativePrompt(theme) {
  return String(theme.costumeNegativePrompt ?? theme.negativePrompt ?? "").trim();
}

/**
 * @param {unknown} value
 * @returns {AiPipelineMode}
 */
export function normalizePipelineMode(value) {
  const mode = String(value ?? DEFAULT_PIPELINE_MODE).trim();
  if (AI_PIPELINE_MODES.includes(mode)) {
    return /** @type {AiPipelineMode} */ (mode);
  }
  return "composite-only";
}

/**
 * @param {AiTheme} theme
 * @returns {AiPipelineMode}
 */
export function getThemePipelineMode(theme) {
  return normalizePipelineMode(theme.pipelineMode);
}

/**
 * @param {AiPipelineMode} mode
 * @returns {boolean}
 */
export function isCompositePipelineMode(mode) {
  return mode === "composite-only" || mode === "composite-costume";
}

/** @type {AiTheme[]} */
export const BUNDLED_AI_THEMES = [
  {
    ...BOOTH_THEME_DEFAULTS,
    id: "wild-west",
    label: "Wild West",
    description: "Koboi sinematik di kota frontier — trend photo booth klasik",
    transformPrompt: buildTransformPrompt(
      [
        "SCENE & WARDROBE: Place the subject in an authentic Old West frontier town at golden hour — weathered wooden saloon buildings, dusty ground, warm sunset backlight, cinematic depth.",
        "Dress in 19th-century cowboy attire: weathered brown leather cowboy hat, suede leather jacket with subtle fringe, muted plaid western shirt, worn blue denim jeans, leather belt with antique buckle, brown cowboy boots, and leather gloves.",
        "Subtle Western accessories only: neck bandana and leather gun belt — tasteful, not overpowering.",
      ].join("\n\n")
    ),
    negativePrompt: buildNegativePrompt(
      "modern fashion, sneakers, studio gray backdrop unchanged, indoor office"
    ),
    costumePrompt: buildCostumePrompt(
      "Authentic 19th-century cowboy attire: weathered brown leather cowboy hat, suede leather jacket with subtle fringe, muted plaid western shirt, worn blue denim jeans, leather belt with antique buckle, brown cowboy boots, leather gloves, subtle neck bandana."
    ),
    costumeNegativePrompt: buildCostumeNegative(
      "weapons, guns, holsters, modern fashion, sneakers"
    ),
    previewColor: "#A67B5B",
    backgroundThemeId: "wild-west",
    lookId: "warm",
  },
  {
    ...BOOTH_THEME_DEFAULTS,
    id: "cyberpunk-neon",
    label: "Cyberpunk Neon",
    description: "Portrait futuristik di kota neon — trend AI photo booth 2025–2026",
    transformPrompt: buildTransformPrompt(
      [
        "SCENE & WARDROBE: Place the subject in a rain-slick cyberpunk city street at night — vibrant neon signs (magenta, cyan, electric blue), holographic ads, wet reflective pavement, cinematic bokeh lights, moody atmosphere.",
        "Dress in sleek futuristic streetwear: black techwear jacket with subtle LED trim, fitted dark pants, tactical boots, minimal cyber accessories (thin AR visor pushed up on forehead or subtle ear tech).",
        "Keep the face natural and photorealistic — no full-face cybernetic implants.",
      ].join("\n\n")
    ),
    negativePrompt: buildNegativePrompt(
      "daylight outdoor park, medieval, western, oversaturated rainbow, full robot face"
    ),
    costumePrompt: buildCostumePrompt(
      "Sleek futuristic streetwear: black techwear jacket with subtle LED trim, fitted dark pants, tactical boots, minimal cyber accessories (thin AR visor pushed up on forehead or subtle ear tech). Natural face — no full-face cybernetics."
    ),
    costumeNegativePrompt: buildCostumeNegative(
      "full robot face, medieval armor, western cowboy"
    ),
    previewColor: "#DB2777",
    backgroundThemeId: "cyberpunk-neon",
    lookId: "cinematic",
    placement: { scale: 0.93, yOffset: 0.035 },
  },
  {
    ...BOOTH_THEME_DEFAULTS,
    id: "royal-fantasy",
    label: "Royal Fantasy",
    description: "Potret kerajaan medieval — trend fantasy portrait booth",
    transformPrompt: buildTransformPrompt(
      [
        "SCENE & WARDROBE: Place the subject in a grand medieval royal throne room — stone arches, rich red velvet drapes, golden candlelight, ornate throne blurred in background, regal cinematic atmosphere.",
        "Dress in elegant royal attire: embroidered velvet doublet or gown in deep burgundy and gold, delicate crown or circlet, fine jewelry, fur-trimmed cape — noble but not cartoonish armor.",
        "Photorealistic fabrics, soft rim light on the subject, shallow depth of field.",
      ].join("\n\n")
    ),
    negativePrompt: buildNegativePrompt(
      "modern clothing, t-shirt, jeans, sci-fi, beach, cartoon armor, oversized weapons"
    ),
    costumePrompt: buildCostumePrompt(
      "Elegant royal attire: embroidered velvet doublet or gown in deep burgundy and gold, delicate crown or circlet, fine jewelry, fur-trimmed cape — noble but not cartoonish armor."
    ),
    costumeNegativePrompt: buildCostumeNegative(
      "oversized weapons, cartoon armor, modern t-shirt, jeans"
    ),
    previewColor: "#7C2D12",
    backgroundThemeId: "royal-fantasy",
    lookId: "cinematic",
    placement: { scale: 0.95, yOffset: 0.028 },
  },
  {
    ...BOOTH_THEME_DEFAULTS,
    id: "k-pop-idol",
    label: "K-Pop Idol",
    description: "Studio idol K-pop — trend portrait booth Asia",
    transformPrompt: buildTransformPrompt(
      [
        "SCENE & WARDROBE: Place the subject on a premium K-pop idol photoshoot set — soft pastel gradient studio backdrop (blush pink to lavender), professional beauty lighting, subtle lens flare, clean high-end music-label aesthetic.",
        "Dress in trendy K-pop stage fashion: stylish coordinated outfit (fitted blazer or cropped jacket, statement earrings, polished hair styling unchanged from source), subtle glitter or rhinestone accents — fashionable but photorealistic.",
        "Flawless but natural skin retouch level, magazine-cover quality.",
      ].join("\n\n")
    ),
    negativePrompt: buildNegativePrompt(
      "western cowboy, medieval, gritty, dark horror, messy background, casual homewear"
    ),
    costumePrompt: buildCostumePrompt(
      "Trendy K-pop stage fashion: stylish coordinated outfit (fitted blazer or cropped jacket, statement earrings), subtle glitter or rhinestone accents — fashionable but photorealistic."
    ),
    costumeNegativePrompt: buildCostumeNegative(
      "western cowboy, medieval, casual homewear"
    ),
    previewColor: "#EC4899",
    backgroundThemeId: "k-pop-idol",
    lookId: "soft",
    placement: { scale: 0.96, yOffset: 0.025 },
  },
  {
    ...BOOTH_THEME_DEFAULTS,
    id: "vintage-glam",
    label: "Vintage Glam",
    description: "Hollywood 1920s glamour — trend Gatsby photo booth",
    transformPrompt: buildTransformPrompt(
      [
        "SCENE & WARDROBE: Place the subject in a luxurious 1920s Art Deco ballroom — gold geometric patterns, warm champagne lighting, soft bokeh chandeliers, black-and-gold elegant atmosphere.",
        "Dress in vintage Hollywood glamour: sequined or satin evening wear, pearl accessories, finger-wave compatible styling (keep original hair if no change needed), classic red-carpet elegance.",
        "Film-grain subtle, warm golden tones, timeless portrait photography look.",
      ].join("\n\n")
    ),
    negativePrompt: buildNegativePrompt(
      "modern streetwear, sci-fi, outdoor nature, casual t-shirt, neon cyberpunk"
    ),
    costumePrompt: buildCostumePrompt(
      "Vintage Hollywood glamour evening wear: sequined or satin dress/suit, pearl accessories, classic red-carpet elegance."
    ),
    costumeNegativePrompt: buildCostumeNegative(
      "modern streetwear, sci-fi, neon cyberpunk, casual t-shirt"
    ),
    previewColor: "#CA8A04",
    backgroundThemeId: "vintage-glam",
    lookId: "warm",
    placement: { scale: 0.94, yOffset: 0.032 },
  },
  {
    ...BOOTH_THEME_DEFAULTS,
    id: "anime-hero",
    label: "Anime Hero",
    description: "Portrait semi-realistic anime — trend cosplay AI booth",
    transformPrompt: buildTransformPrompt(
      [
        "SCENE & WARDROBE: Place the subject in a dramatic anime-inspired hero scene — stylized sky with volumetric light rays, floating sakura petals or energy particles, vibrant but cinematic background.",
        "Apply a semi-realistic anime aesthetic to costume and environment while keeping the face photorealistic and identical to the source — cel-shaded clothing edges, hero outfit (stylized jacket with bold colors, flowing scarf or cape), dynamic wind effect on fabric.",
        "Balance: recognizable same person + anime world styling — not full cartoon face.",
      ].join("\n\n")
    ),
    negativePrompt: buildNegativePrompt(
      "full cartoon face, chibi, different eye color, western cowboy, realistic office, 3D render look"
    ),
    costumePrompt: buildCostumePrompt(
      "Semi-realistic anime hero outfit: stylized jacket with bold colors, flowing scarf or cape, dynamic wind effect on fabric — cel-shaded clothing edges only, face stays photorealistic."
    ),
    costumeNegativePrompt: buildCostumeNegative(
      "full cartoon face, chibi, western cowboy, office wear"
    ),
    previewColor: "#6366F1",
    backgroundThemeId: "anime-hero",
    lookId: "cinematic",
    placement: { scale: 0.92, yOffset: 0.04 },
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
  const costumePrompt = String(entry.costumePrompt ?? "").trim();
  const costumeNegativePrompt = String(entry.costumeNegativePrompt ?? "").trim();
  const label = String(entry.label ?? "").trim();
  const description = String(entry.description ?? "").trim();
  const previewColor = String(entry.previewColor ?? "#888888").trim();
  const backgroundThemeId = String(entry.backgroundThemeId ?? entry.id ?? "").trim() || id;
  const pipelineMode = normalizePipelineMode(entry.pipelineMode);
  const backgroundRequired =
    entry.backgroundRequired === undefined
      ? isCompositePipelineMode(pipelineMode)
      : Boolean(entry.backgroundRequired);
  const lookId =
    entry.lookId === null || entry.lookId === undefined
      ? undefined
      : String(entry.lookId).trim() || undefined;
  const placement =
    entry.placement && typeof entry.placement === "object"
      ? {
          ...(Number(entry.placement.scale) ? { scale: Number(entry.placement.scale) } : {}),
          ...(Number(entry.placement.yOffset)
            ? { yOffset: Number(entry.placement.yOffset) }
            : {}),
        }
      : undefined;
  const overlays = Array.isArray(entry.overlays)
    ? entry.overlays
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const file = String(item.file ?? "").trim();
          if (!file) return null;
          return {
            file,
            ...(item.blend ? { blend: String(item.blend) } : {}),
            ...(item.opacity !== undefined ? { opacity: Number(item.opacity) } : {}),
          };
        })
        .filter(Boolean)
    : undefined;

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
    pipelineMode,
    backgroundRequired,
    ...(costumePrompt ? { costumePrompt } : {}),
    ...(costumeNegativePrompt ? { costumeNegativePrompt } : {}),
    ...(lookId ? { lookId } : {}),
    ...(placement && Object.keys(placement).length ? { placement } : {}),
    ...(overlays?.length ? { overlays } : {}),
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
 * Bundled themes are overridden when the same id is published.
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
