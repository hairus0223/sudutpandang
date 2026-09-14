import fs from "fs";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";
import { resolveBaseDir } from "./studioPaths.js";
import { listAiThemes } from "./aiThemes.js";

/**
 * Per-theme print knobs. Global fallback: {BASE_DIR}/config/theme-print-tune.json
 * Per theme: {BASE_DIR}/config/theme-print-tunes/{themeId}.json
 */

function num(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function bool(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

const tuneAls = new AsyncLocalStorage();

function safeThemeId(themeId) {
  const id = String(themeId || "").trim();
  if (!id) return null;
  return id.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
}

/** Best starting point: original theme photo in focus, 50mm f/4.5. */
export const THEME_PRINT_TUNE_DEFAULTS = {
  hairHaloKill: num("THEME_HAIR_HALO_KILL", 0.52),
  hairFeather: num("THEME_HAIR_FEATHER", 1.15),
  edgeBgBlend: num("THEME_EDGE_BG_BLEND", 0.4),
  focalLengthMm: num("THEME_FOCAL_LENGTH_MM", 50),
  aperture: num("THEME_APERTURE", 4.5),
  backdropDistanceM: num("THEME_BACKDROP_DISTANCE_M", 4.5),
  autoFocus: bool("THEME_AUTO_FOCUS", true),
  alphaFeather: num("THEME_ALPHA_FEATHER", 0.75),
  lightWrap: num("THEME_LIGHT_WRAP", 0.26),
  colorMatch: num("THEME_COLOR_MATCH", 0.36),
  warmth: num("THEME_WARMTH", 0),
  cinematicFinish: bool("THEME_CINEMATIC_FINISH", false),
  cinematicIntensity: num("THEME_CINEMATIC_INTENSITY", 0.12),
  contactShadow: bool("THEME_CONTACT_SHADOW", true),
  harmonize: bool("THEME_HARMONIZE_ENABLED", true),
  lookBake: bool("THEME_LOOK_BAKE", false),
};

export const THEME_PRINT_PRESETS = {
  recommended: {
    id: "recommended",
    label: "50mm f/4.5",
    hint: "Tema asli kebaca, seperti kamera studio. Pakai ini dulu.",
    values: {
      hairHaloKill: 0.52,
      hairFeather: 1.15,
      edgeBgBlend: 0.4,
      focalLengthMm: 50,
      aperture: 4.5,
      backdropDistanceM: 4.5,
      autoFocus: true,
      alphaFeather: 0.75,
      lightWrap: 0.26,
      colorMatch: 0.36,
      warmth: 0,
      cinematicFinish: false,
      cinematicIntensity: 0.12,
      contactShadow: true,
      harmonize: true,
      lookBake: false,
    },
  },
  bokeh: {
    id: "bokeh",
    label: "85mm f/2.2",
    hint: "Portrait: orang lebih besar, latar sedikit defocus. Tema masih kelihatan.",
    values: {
      hairHaloKill: 0.52,
      hairFeather: 1.2,
      edgeBgBlend: 0.42,
      focalLengthMm: 85,
      aperture: 2.2,
      backdropDistanceM: 5.5,
      autoFocus: true,
      alphaFeather: 0.8,
      lightWrap: 0.28,
      colorMatch: 0.34,
      warmth: 0,
      cinematicFinish: false,
      cinematicIntensity: 0.14,
      contactShadow: true,
      harmonize: true,
      lookBake: false,
    },
  },
  sharp: {
    id: "sharp",
    label: "35mm f/5.6",
    hint: "Lebih banyak set/tema di frame, hampir semua tajam.",
    values: {
      hairHaloKill: 0.5,
      hairFeather: 1.1,
      edgeBgBlend: 0.38,
      focalLengthMm: 35,
      aperture: 5.6,
      backdropDistanceM: 4.2,
      autoFocus: true,
      alphaFeather: 0.7,
      lightWrap: 0.24,
      colorMatch: 0.32,
      warmth: 0,
      cinematicFinish: false,
      cinematicIntensity: 0.1,
      contactShadow: true,
      harmonize: true,
      lookBake: false,
    },
  },
};

export const THEME_PRINT_TUNE_FIELDS = [
  {
    key: "hairHaloKill",
    label: "Halo putih rambut",
    hint: "Mahkota putih = sisa dinding booth. Naikkan sampai putih hilang. Turunkan jika rambut jadi bolong.",
    min: 0,
    max: 1,
    step: 0.05,
    kind: "range",
    group: "Rambut & tepi",
  },
  {
    key: "hairFeather",
    label: "Lembut ujung rambut",
    hint: "Membuat rambut tipis menyatu ke warna tema. 1.4–1.8 natural. Terlalu tinggi = rambut kabur.",
    min: 0,
    max: 3,
    step: 0.05,
    kind: "range",
    group: "Rambut & tepi",
  },
  {
    key: "edgeBgBlend",
    label: "Semua tepi ke warna tema",
    hint: "Bahu, lengan, leher mengambil warna background. Naikkan jika masih garis stiker. Turunkan jika baju luntur.",
    min: 0,
    max: 1,
    step: 0.05,
    kind: "range",
    group: "Rambut & tepi",
  },
  {
    key: "alphaFeather",
    label: "Lembut tepi badan",
    hint: "Pinggiran tubuh (bukan wajah). 0.9–1.2 studio. Terlalu tinggi = orang seperti berasap.",
    min: 0,
    max: 2.5,
    step: 0.05,
    kind: "range",
    group: "Rambut & tepi",
  },
  {
    key: "focalLengthMm",
    label: "Focal length (mm)",
    hint: "35mm = lebih banyak tema di frame. 50mm studio. 85mm portrait, orang lebih close.",
    min: 24,
    max: 135,
    step: 1,
    kind: "range",
    group: "Kamera",
  },
  {
    key: "aperture",
    label: "Aperture (f-number)",
    hint: "f/4.5–5.6 tema tajam. f/2–2.8 latar lebih lembut. Angka lebih besar = lebih tajam.",
    min: 1.8,
    max: 8,
    step: 0.1,
    kind: "range",
    group: "Kamera",
  },
  {
    key: "backdropDistanceM",
    label: "Jarak latar (meter)",
    hint: "Seberapa jauh foto tema di belakang orang. 4–5 m set booth. Naikkan = bokeh sedikit lebih.",
    min: 2.5,
    max: 12,
    step: 0.1,
    kind: "range",
    group: "Kamera",
  },
  {
    key: "autoFocus",
    label: "Auto-focus wajah",
    hint: "Jarak fokus mengikuti dekat/jauhnya orang (selfie vs full body), seperti kamera.",
    kind: "toggle",
    group: "Kamera",
  },
  {
    key: "lightWrap",
    label: "Cahaya tema di tepi",
    hint: "Warna lampu scene merembes di pinggiran (bukan di tengah wajah). 0.16–0.24 pro.",
    min: 0,
    max: 0.6,
    step: 0.02,
    kind: "range",
    group: "Look studio",
  },
  {
    key: "colorMatch",
    label: "Kekuatan samakan warna",
    hint: "Seberapa kuat kulit mengikuti cahaya tema. 0.4–0.6 natural. Tidak mengubah foto latar.",
    min: 0,
    max: 1,
    step: 0.05,
    kind: "range",
    group: "Look studio",
  },
  {
    key: "warmth",
    label: "Hangat / dingin",
    hint: "0 netral. Plus = lebih hangat (kuning). Minus = lebih dingin. Hanya orang, bukan latar.",
    min: -8,
    max: 8,
    step: 1,
    kind: "range",
    group: "Look studio",
  },
  {
    key: "cinematicIntensity",
    label: "Kekuatan look film",
    hint: "Kontras + vignette halus. 0.22–0.32 aman cetak 4R.",
    min: 0,
    max: 0.8,
    step: 0.02,
    kind: "range",
    group: "Look studio",
  },
  {
    key: "cinematicFinish",
    label: "Look film",
    hint: "Vignette halus saja — tidak mengubah warna tema.",
    kind: "toggle",
    group: "Look studio",
  },
  {
    key: "contactShadow",
    label: "Bayangan kaki",
    hint: "Bayangan halus di tanah tema supaya tidak melayang.",
    kind: "toggle",
    group: "Look studio",
  },
  {
    key: "harmonize",
    label: "Samakan warna kulit–latar",
    hint: "Hanya menyesuaikan kecerahan/suhu orang. Latar tetap foto tema (bisa di-blur). Matikan jika kulit terasa kebiruan.",
    kind: "toggle",
    group: "Look studio",
  },
  {
    key: "lookBake",
    label: "Kunci warna ke file cetak",
    hint: "Look tema ditulis ke orang di JPEG cetak. Latar tidak di-recolor.",
    kind: "toggle",
    group: "Look studio",
  },
];

function tuneFilePath(baseDir = resolveBaseDir()) {
  return path.join(baseDir, "config", "theme-print-tune.json");
}

function themeTuneFilePath(themeId, baseDir = resolveBaseDir()) {
  return path.join(baseDir, "config", "theme-print-tunes", `${themeId}.json`);
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeTune(file, next) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2)
  );
}

function migrateLegacyOptics(src) {
  if (src.focalLengthMm != null || src.aperture != null) return src;
  const blur = Number(src.bgBlur);
  if (!Number.isFinite(blur)) return src;
  return {
    ...src,
    focalLengthMm: 50,
    aperture: blur >= 2 ? 2.2 : blur >= 0.8 ? 3.5 : 5.6,
    backdropDistanceM: 4.5,
    autoFocus: src.autoBokeh !== false,
  };
}

function migrateLegacyMatte(src) {
  const edge = Number(src.edgeBgBlend);
  const halo = Number(src.hairHaloKill);
  if (!(edge >= 0.68 || halo >= 0.75)) return src;
  return {
    ...src,
    hairHaloKill: Math.min(Number.isFinite(halo) ? halo : 0.52, 0.55),
    edgeBgBlend: Math.min(Number.isFinite(edge) ? edge : 0.4, 0.45),
    hairFeather: Math.min(Number(src.hairFeather) || 1.15, 1.2),
    alphaFeather: Math.min(Number(src.alphaFeather) || 0.75, 0.85),
    lightWrap: Math.max(Number(src.lightWrap) || 0, 0.24),
    colorMatch: Math.max(Number(src.colorMatch) || 0, 0.32),
  };
}

function sanitize(input = {}) {
  const src = migrateLegacyMatte(
    migrateLegacyOptics(input && typeof input === "object" ? input : {})
  );
  return {
    hairHaloKill: clamp(src.hairHaloKill ?? 0.52, 0, 1),
    hairFeather: clamp(src.hairFeather ?? 1.15, 0, 3),
    edgeBgBlend: clamp(src.edgeBgBlend ?? 0.4, 0, 1),
    focalLengthMm: clamp(src.focalLengthMm ?? 50, 24, 135),
    aperture: clamp(src.aperture ?? 4.5, 1.8, 8),
    backdropDistanceM: clamp(src.backdropDistanceM ?? 4.5, 2.5, 12),
    autoFocus: src.autoFocus !== false,
    alphaFeather: clamp(src.alphaFeather ?? 0.75, 0, 2.5),
    lightWrap: clamp(src.lightWrap ?? 0.26, 0, 0.6),
    colorMatch: clamp(src.colorMatch ?? 0.36, 0, 1),
    warmth: clamp(src.warmth ?? 0, -8, 8),
    cinematicFinish: src.cinematicFinish === true,
    cinematicIntensity: clamp(src.cinematicIntensity ?? 0.12, 0, 0.8),
    contactShadow: src.contactShadow !== false,
    harmonize: src.harmonize !== false,
    lookBake: src.lookBake === true,
  };
}

export function runWithThemeTune(themeId, fn) {
  return tuneAls.run({ themeId: safeThemeId(themeId) }, fn);
}

export function getActiveTuneThemeId() {
  return tuneAls.getStore()?.themeId || null;
}

export function getThemePrintTune(baseDir = resolveBaseDir(), themeId) {
  const id = safeThemeId(themeId) || getActiveTuneThemeId();
  const globalSaved = readJson(tuneFilePath(baseDir));
  const themeSaved = id ? readJson(themeTuneFilePath(id, baseDir)) : null;
  return sanitize({
    ...THEME_PRINT_TUNE_DEFAULTS,
    ...(globalSaved && typeof globalSaved === "object" ? globalSaved : {}),
    ...(themeSaved && typeof themeSaved === "object" ? themeSaved : {}),
  });
}

export function saveThemePrintTune(
  partial,
  baseDir = resolveBaseDir(),
  themeId
) {
  const id = safeThemeId(themeId) || getActiveTuneThemeId();
  const next = sanitize({
    ...getThemePrintTune(baseDir, id),
    ...partial,
  });
  const file = id ? themeTuneFilePath(id, baseDir) : tuneFilePath(baseDir);
  writeTune(file, { ...next, themeId: id || null });
  return next;
}

export function applyThemePrintPreset(
  presetId,
  baseDir = resolveBaseDir(),
  themeId
) {
  const preset = THEME_PRINT_PRESETS[presetId] || THEME_PRINT_PRESETS.recommended;
  return saveThemePrintTune(preset.values, baseDir, themeId);
}

export function getThemePrintTunePublic(baseDir = resolveBaseDir(), themeId) {
  const id = safeThemeId(themeId);
  return {
    themeId: id,
    tune: getThemePrintTune(baseDir, id),
    defaults: sanitize(THEME_PRINT_TUNE_DEFAULTS),
    presets: Object.values(THEME_PRINT_PRESETS),
    fields: THEME_PRINT_TUNE_FIELDS,
    persistPath: id
      ? `config/theme-print-tunes/${id}.json`
      : "config/theme-print-tune.json",
    themes: listAiThemes(baseDir).map((theme) => ({
      id: theme.id,
      label: theme.label,
    })),
  };
}
