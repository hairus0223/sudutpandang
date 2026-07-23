import "dotenv/config";
import express from "express";
import cors from "cors";
import path, { dirname } from "path";
import fs from "fs";
import chokidar from "chokidar";
import http from "http";
import { Server } from "socket.io";
import sharp from "sharp";
import { exec } from "child_process";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import multer from "multer";
import {
  PROCESSING_STATUS,
  createPendingMeta,
  readMeta,
  saveOriginalFromCapture,
  saveUploadedToCaptures,
} from "./services/imageStorage.js";
import { bootstrapStudioDirs, resolveBaseDir } from "./services/studioPaths.js";
import { readCustomerJson } from "./services/customerConfig.js";
import {
  normalizePackageType,
  getPackageDurations,
  getPackageDurationMinutes,
  resolveAiGenerateLimit,
  readAiQuotaFromCustomer,
  getAiGenerationConfig,
  isAiGenerationEnabled,
  PACKAGE_TYPES,
} from "./services/packageTypes.js";
import { listAiThemesPublic, getAiTheme, buildAiJobId, toPublicAiTheme } from "./services/aiThemes.js";
import { BUNDLED_THEME_PREVIEWS_DIR } from "./services/aiThemePreviews.js";
import {
  findAiSelectionByJobId,
  findAiSelectionForImage,
  readAiQuotaWithPending,
  readSessionTheme,
  reserveAiQuota,
  setSessionTheme,
  lockSessionTheme,
  upsertAiSelection,
  getAiSelections,
} from "./services/aiCustomer.js";
import { enqueueAiGenerationJob, getAiQueueStats } from "./services/aiGenerationQueue.js";
import { getAiPipelineStatus } from "./services/aiGeneration.js";
import { logAiAnalyticsEvent, getAiAnalyticsSummary } from "./services/aiAnalytics.js";
import {
  getPublicStudioConfig,
  logStartupValidation,
  validateStudioConfig,
} from "./services/studioConfig.js";
import { initPromoToolsDb } from "./services/promo-tools/db.js";
import { resolvePromoToolsUploadDir } from "./services/promo-tools/paths.js";
import { createPromoToolsRouter } from "./routes/promo-tools/index.js";
import { createAdminRouter } from "./routes/admin/index.js";
import { isAdminApiEnabled } from "./services/adminAuth.js";
import {
  prewarmPersonSegmentation,
  validatePersonSegmentationAssets,
} from "./services/personSegmentation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUNDLED_THEME_ASSETS_DIR = path.join(__dirname, "assets", "themes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;
const PUBLIC_HOST = process.env.API_PUBLIC_HOST || `localhost:${PORT}`;
const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 20 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("invalid_file_type"));
  },
});

// ======================
// BASE DIRECTORY
// ======================
const BASE_DIR = resolveBaseDir();
bootstrapStudioDirs(BASE_DIR);
initPromoToolsDb(BASE_DIR);

const STUDIO_PUBLIC_CONFIG = getPublicStudioConfig({
  baseDir: BASE_DIR,
  publicHost: PUBLIC_HOST,
  port: PORT,
});

const STARTUP_VALIDATION = validateStudioConfig({
  baseDir: BASE_DIR,
  publicHost: PUBLIC_HOST,
  port: PORT,
});

logStartupValidation({
  validation: STARTUP_VALIDATION,
  config: STUDIO_PUBLIC_CONFIG,
});

validatePersonSegmentationAssets();

// Folder INPUT dari Imaging Edge
const CAPTURE_DIR = path.join(BASE_DIR, "capture");

// ======================
// HELPERS
// ======================
function getTodayFolder() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, "0")}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${today.getFullYear()}`;
}

/** Physical print copies from people count (studio default). */
function copiesForPeopleCount(peopleCount) {
  const people = Math.max(1, Number(peopleCount) || 1);
  if (people === 1) return 2;
  if (people === 2) return 3;
  return 5;
}

// Konversi pixel → point untuk PDF
const pxToPt = (px, dpi = 300) => (px / dpi) * 72;

function buildPublicImageUrl(todayFolder, userSlug, relativePath, host = PUBLIC_HOST) {
  const normalized = relativePath.split(path.sep).join("/");
  return `http://${host}/images/${todayFolder}/${userSlug}/${normalized}`;
}

function buildVariantUrls(host, todayFolder, userSlug, meta) {
  const variants = {};

  if (meta?.variants?.original) {
    variants.original = buildPublicImageUrl(
      todayFolder,
      userSlug,
      String(meta.variants.original),
      host
    );
  }

  if (meta?.variants?.ai && typeof meta.variants.ai === "object") {
    /** @type {Record<string, string>} */
    variants.ai = {};
    for (const [themeId, relPath] of Object.entries(meta.variants.ai)) {
      if (!relPath) continue;
      variants.ai[themeId] = buildPublicImageUrl(
        todayFolder,
        userSlug,
        String(relPath),
        host
      );
    }
  }

  return variants;
}

function buildAiSelectionsIndex(userPath) {
  const customer = readCustomerJson(userPath);
  /** @type {Map<string, Record<string, unknown>>} */
  const byImage = new Map();

  for (const entry of getAiSelections(customer)) {
    const imageId = String(entry.imageId || "");
    if (!imageId) continue;
    byImage.set(imageId, entry);
  }

  return byImage;
}

function getUserPathForToday(userSlug) {
  return path.join(BASE_DIR, getTodayFolder(), userSlug);
}

function buildKioskSyncFields(userSlug, fallback = {}) {
  const userFolder = getUserPathForToday(userSlug);
  const data = readCustomerJson(userFolder);
  const packageType = normalizePackageType(
    data?.packageType ?? fallback.packageType ?? activeSession?.packageType
  );
  const peopleCount =
    data?.peopleCount ?? activeSession?.peopleCount ?? fallback.peopleCount ?? 1;
  const sessionTheme = readSessionTheme(data);
  const aiQuota = readAiQuotaFromCustomer(data);
  const themePublic =
    sessionTheme.themeId
      ? toPublicAiTheme(getAiTheme(sessionTheme.themeId, BASE_DIR), BASE_DIR, PUBLIC_HOST)
      : null;

  return {
    packageType,
    peopleCount,
    aiThemeId: sessionTheme.themeId,
    aiThemeLabel: sessionTheme.label,
    aiThemePreviewUrl: themePublic?.previewUrl ?? null,
    aiThemePreviewColor: themePublic?.previewColor ?? null,
    aiThemeType: themePublic?.type ?? null,
    aiGenerateLimit: aiQuota.limit,
  };
}

function listUserImages(userPath, host, todayFolder, userSlug) {
  const images = [];
  const aiByImage = buildAiSelectionsIndex(userPath);

  if (fs.existsSync(userPath)) {
    for (const filename of fs.readdirSync(userPath)) {
      if (!/\.(jpg|jpeg|png)$/i.test(filename)) continue;
      const imageId = path.basename(filename, path.extname(filename));
      images.push({
        filename,
        url: `http://${host}/images/${todayFolder}/${userSlug}/${filename}`,
        imageId,
        processingStatus: "none",
        variants: {
          original: `http://${host}/images/${todayFolder}/${userSlug}/${filename}`,
        },
        aiSelection: aiByImage.get(imageId) ?? null,
      });
    }
  }

  const capturesDir = path.join(userPath, "captures");
  if (fs.existsSync(capturesDir)) {
    for (const filename of fs.readdirSync(capturesDir)) {
      if (!/\.(jpg|jpeg|png)$/i.test(filename)) continue;
      const imageId = path.basename(filename, path.extname(filename));
      const meta = readMeta(userPath, imageId);
      const variants = buildVariantUrls(host, todayFolder, userSlug, meta);
      if (!variants.original) {
        variants.original = `http://${host}/images/${todayFolder}/${userSlug}/captures/${filename}`;
      }
      images.push({
        filename,
        url: variants.original,
        imageId,
        processingStatus: meta?.status ?? "none",
        processingError: meta?.error ?? null,
        variants,
        aiSelection: aiByImage.get(imageId) ?? null,
      });
    }
  }

  return images.sort((a, b) => a.filename.localeCompare(b.filename));
}

// Ukuran 4R @300DPI
const widthPx = 6 * 300; // 6 inch
const heightPx = 4 * 300; // 4 inch
const pdfWidthPt = pxToPt(widthPx);
const pdfHeightPt = pxToPt(heightPx);

// ======================
// MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  "/images",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(BASE_DIR)
);
app.use(
  "/headline",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(BASE_DIR, "headline"))
);

app.use(
  "/themes",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(BASE_DIR, "themes"))
);

app.use(
  "/theme-previews",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(BUNDLED_THEME_PREVIEWS_DIR)
);

app.use(
  "/theme-assets",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(BUNDLED_THEME_ASSETS_DIR)
);

app.use(
  "/promo-tools/files",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(resolvePromoToolsUploadDir(BASE_DIR))
);

app.use(
  "/research/files",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(BASE_DIR, "research"))
);

app.use("/api/promo-tools", createPromoToolsRouter({ publicHost: PUBLIC_HOST }));
app.use(
  "/api/admin",
  createAdminRouter({ baseDir: BASE_DIR, publicHost: PUBLIC_HOST })
);

// ======================
// SESSION STATE & CONFIG
// ======================
let activeSession = null;
let sessionLocked = false;

const SESSION_DURATION_MINUTES =
  process.env.SESSION_DURATION_MINUTES &&
  !Number.isNaN(Number(process.env.SESSION_DURATION_MINUTES))
    ? Number(process.env.SESSION_DURATION_MINUTES)
    : 10;

const CAPTURE_COUNTDOWN_SECONDS =
  process.env.CAPTURE_COUNTDOWN_SECONDS &&
  !Number.isNaN(Number(process.env.CAPTURE_COUNTDOWN_SECONDS))
    ? Number(process.env.CAPTURE_COUNTDOWN_SECONDS)
    : 3;

const TRIAL_DURATION_SECONDS =
  process.env.TRIAL_DURATION_SECONDS &&
  !Number.isNaN(Number(process.env.TRIAL_DURATION_SECONDS))
    ? Number(process.env.TRIAL_DURATION_SECONDS)
    : 60;

const PACKAGE_DURATIONS = getPackageDurations();

function buildSessionTimerUpdate(session) {
  if (!session) return null;

  const kioskFields = buildKioskSyncFields(session.user, {
    packageType: session.packageType,
    peopleCount: session.peopleCount,
  });

  return {
    user: session.user,
    endsAt: session.endsAt,
    pausedAt: session.pausedAt,
    remainingMs: session.pausedAt
      ? session.remainingMs
      : Math.max(0, session.endsAt - Date.now()),
    phase: session.phase ?? null,
    ...kioskFields,
  };
}

function emitSessionTimerUpdate(session = activeSession) {
  const payload = buildSessionTimerUpdate(session);
  if (payload) io.emit("session-timer-update", payload);
}

// ======================
// REGISTER CUSTOMER
// ======================
app.post("/api/register", (req, res) => {
  const {
    name,
    phone = "",
    peopleCount = 1,
    templateId = "4R",
    packageType: rawPackageType,
    aiThemeId: rawAiThemeId,
  } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "")
    return res.status(400).json({ error: "invalid data" });

  const people = Math.max(1, Math.min(8, Number(peopleCount) || 1));
  const packageType = normalizePackageType(rawPackageType);
  const aiGenerateLimit = resolveAiGenerateLimit(packageType, people);

  let aiThemeId = null;
  let aiThemeLabel = null;
  if (packageType === "ai-self-photo") {
    const theme = getAiTheme(rawAiThemeId, BASE_DIR);
    if (!theme) {
      return res.status(400).json({ error: "theme_required" });
    }
    aiThemeId = theme.id;
    aiThemeLabel = theme.label;
  }

  const slugName = name.trim().replace(/\s+/g, "_");
  const todayFolder = getTodayFolder();
  const userFolder = path.join(BASE_DIR, todayFolder, slugName);

  const registeredAt = new Date().toISOString();
  const aiThemeLockedAt =
    packageType === "ai-self-photo" && aiThemeId ? registeredAt : null;

  const customerData = {
    name: name.trim(),
    phone: typeof phone === "string" ? phone.trim() : "",
    peopleCount: people,
    user: slugName,
    templateId,
    packageType,
    printLimit: people,
    aiGenerateLimit,
    aiGenerateUsed: 0,
    aiThemeId,
    aiThemeLockedAt,
    aiSelections: [],
    folderPath: `/images/${todayFolder}/${slugName}`,
    registeredAt,
  };

  fs.mkdirSync(userFolder, { recursive: true });
  fs.writeFileSync(
    path.join(userFolder, "customer.json"),
    JSON.stringify(customerData, null, 2)
  );

  if (packageType === "ai-self-photo" && aiThemeId) {
    logAiAnalyticsEvent(BASE_DIR, {
      type: "theme_selected",
      user: slugName,
      themeId: aiThemeId,
      source: "register",
    });
  }

  const host = req.headers.host || PUBLIC_HOST;
  const themePublic =
    packageType === "ai-self-photo" && aiThemeId
      ? toPublicAiTheme(getAiTheme(aiThemeId, BASE_DIR), BASE_DIR, host)
      : null;

  res.json({
    success: true,
    customer: {
      ...customerData,
      aiThemeLabel,
      aiThemeLocked: Boolean(aiThemeLockedAt),
      ...(themePublic
        ? {
            aiThemeType: themePublic.type,
            aiThemePreviewUrl: themePublic.previewUrl,
            aiThemePreviewBeforeUrl: themePublic.previewBeforeUrl ?? null,
          }
        : {}),
    },
  });
});

// Cek customer by name (today's folder) untuk kontrol sesi dari studio-kiosk
app.get("/api/customer-by-name", (req, res) => {
  const name = (req.query.name || "").toString().trim();
  if (!name) return res.status(400).json({ error: "name required" });

  const slugName = name.replace(/\s+/g, "_");
  const todayFolder = getTodayFolder();
  const file = path.join(BASE_DIR, todayFolder, slugName, "customer.json");

  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  const packageType = normalizePackageType(data.packageType);
  const sessionTheme = readSessionTheme(data);
  const aiQuota = readAiQuotaFromCustomer(data);
  const host = req.headers.host || PUBLIC_HOST;
  const themePublic =
    sessionTheme.themeId
      ? toPublicAiTheme(getAiTheme(sessionTheme.themeId, BASE_DIR), BASE_DIR, host)
      : null;

  res.json({
    success: true,
    customer: {
      ...data,
      packageType,
      aiThemeLabel: sessionTheme.label,
      aiThemeLocked: sessionTheme.locked,
      aiGenerateLimit: aiQuota.limit,
      aiThemePreviewUrl: themePublic?.previewUrl ?? null,
      aiThemeType: themePublic?.type ?? null,
      aiThemePreviewBeforeUrl: themePublic?.previewBeforeUrl ?? null,
    },
  });
});

app.get("/api/print-config/:user", (req, res) => {
  const { user } = req.params;
  const todayFolder = getTodayFolder();
  const file = path.join(BASE_DIR, todayFolder, user, "customer.json");

  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  const packageType = normalizePackageType(data.packageType);
  const aiQuota = readAiQuotaFromCustomer(data);
  const sessionTheme = readSessionTheme(data);
  const host = req.headers.host || PUBLIC_HOST;
  const themePublic =
    sessionTheme.themeId
      ? toPublicAiTheme(getAiTheme(sessionTheme.themeId, BASE_DIR), BASE_DIR, host)
      : null;
  res.json({
    allowedPrint: data.printLimit,
    peopleCount: data.peopleCount ?? 1,
    printCopies: copiesForPeopleCount(data.peopleCount ?? 1),
    templateId: data.templateId,
    name: data.name,
    packageType,
    aiGenerateLimit: aiQuota.limit,
    aiGenerateUsed: aiQuota.used,
    aiGenerateRemaining: aiQuota.remaining,
    aiThemeId: sessionTheme.themeId,
    aiThemeLabel: sessionTheme.label,
    aiThemeLocked: sessionTheme.locked,
    aiThemePreviewUrl: themePublic?.previewUrl ?? null,
    aiThemeType: themePublic?.type ?? null,
    aiThemePreviewBeforeUrl: themePublic?.previewBeforeUrl ?? null,
  });
});

app.get("/api/themes", (_req, res) => {
  res.status(404).json({ error: "not_available" });
});

app.post("/api/images/:user/:imageId/process", (_req, res) => {
  res.status(404).json({ error: "not_available" });
});

app.get("/api/health", (_req, res) => {
  const ok = STARTUP_VALIDATION.ok;

  res.status(ok ? 200 : 503).json({
    ok,
    mode: "studio",
    packages: PACKAGE_TYPES,
    aiGeneration: getAiPipelineStatus(),
    aiQueue: getAiQueueStats(),
    uptimeSec: Math.floor(process.uptime()),
    config: STUDIO_PUBLIC_CONFIG,
    validation: {
      warnings: STARTUP_VALIDATION.warnings,
      errors: STARTUP_VALIDATION.errors,
    },
  });
});

app.get("/api/health/image-processing", (_req, res) => {
  const ok = STARTUP_VALIDATION.ok;
  const pipeline = getAiPipelineStatus();

  res.status(ok ? 200 : 503).json({
    ok,
    mode: "studio",
    packages: PACKAGE_TYPES,
    aiGeneration: pipeline,
    aiQueue: getAiQueueStats(),
    message: pipeline.enabled
      ? "AI Self Photo pipeline ready"
      : "AI generation disabled",
  });
});

app.get("/api/ai-quota/:user", (req, res) => {
  const { user } = req.params;
  const todayFolder = getTodayFolder();
  const file = path.join(BASE_DIR, todayFolder, user, "customer.json");

  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: "not_found" });
  }

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  const packageType = normalizePackageType(data.packageType);
  const aiQuota = readAiQuotaFromCustomer(data);
  const pendingQuota = readAiQuotaWithPending(path.dirname(file));
  const sessionTheme = readSessionTheme(data);

  res.json({
    user,
    packageType,
    peopleCount: data.peopleCount ?? 1,
    aiGenerateLimit: aiQuota.limit,
    aiGenerateUsed: aiQuota.used,
    aiGenerateRemaining: aiQuota.remaining,
    aiGeneratePending: pendingQuota.pending,
    aiGenerateAvailable: pendingQuota.available,
    aiThemeId: sessionTheme.themeId,
    aiThemeLabel: sessionTheme.label,
    aiThemeLocked: sessionTheme.locked,
    aiEnabled: packageType === "ai-self-photo" && getAiGenerationConfig().enabled,
  });
});

app.get("/api/ai-themes", (req, res) => {
  if (!isAiGenerationEnabled()) {
    return res.status(503).json({ error: "ai_disabled" });
  }

  const host = req.headers.host || PUBLIC_HOST;
  res.json({
    themes: listAiThemesPublic(BASE_DIR, host),
    pipeline: getAiPipelineStatus(),
  });
});

app.get("/api/ai-analytics/summary", (req, res) => {
  const days = Number(req.query.days) || 30;
  res.json(getAiAnalyticsSummary(BASE_DIR, { days }));
});

app.patch("/api/ai-theme/:user", (req, res) => {
  const { user } = req.params;
  const { themeId } = req.body ?? {};

  if (!themeId || typeof themeId !== "string") {
    return res.status(400).json({ error: "theme_id_required" });
  }

  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);

  if (!fs.existsSync(path.join(userPath, "customer.json"))) {
    return res.status(404).json({ error: "customer_not_found" });
  }

  try {
    const result = setSessionTheme(userPath, themeId);
    logAiAnalyticsEvent(BASE_DIR, {
      type: "theme_selected",
      user,
      themeId: result.themeId,
      source: "patch",
    });
    res.json({
      success: true,
      user,
      aiThemeId: result.themeId,
      aiThemeLabel: result.label,
      aiThemeLocked: false,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === "theme_locked") {
      return res.status(409).json({ error: "theme_locked" });
    }
    if (code === "invalid_theme") {
      return res.status(400).json({ error: "invalid_theme" });
    }
    if (code === "package_not_ai") {
      return res.status(403).json({ error: "package_not_ai" });
    }
    return res.status(400).json({ error: code });
  }
});

app.post("/api/ai-generate", (req, res) => {
  if (!isAiGenerationEnabled()) {
    return res.status(503).json({ error: "ai_disabled" });
  }

  const { user, imageId, themeId: rawThemeId } = req.body ?? {};

  if (!user || typeof user !== "string") {
    return res.status(400).json({ error: "user_required" });
  }
  if (!imageId || typeof imageId !== "string") {
    return res.status(400).json({ error: "image_id_required" });
  }

  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);
  const customerPath = path.join(userPath, "customer.json");

  if (!fs.existsSync(customerPath)) {
    return res.status(404).json({ error: "customer_not_found" });
  }

  const customer = JSON.parse(fs.readFileSync(customerPath, "utf-8"));
  const packageType = normalizePackageType(customer.packageType);
  if (packageType !== "ai-self-photo") {
    return res.status(403).json({ error: "package_not_ai" });
  }

  const sessionTheme = readSessionTheme(customer);
  if (!sessionTheme.themeId) {
    return res.status(400).json({ error: "theme_required" });
  }

  if (
    rawThemeId &&
    typeof rawThemeId === "string" &&
    rawThemeId !== sessionTheme.themeId
  ) {
    return res.status(409).json({ error: "theme_mismatch" });
  }

  const theme = getAiTheme(sessionTheme.themeId, BASE_DIR);
  if (!theme) {
    return res.status(400).json({ error: "invalid_theme" });
  }

  const captureExists =
    fs.existsSync(path.join(userPath, "captures", `${imageId}.jpg`)) ||
    fs.existsSync(path.join(userPath, "captures", `${imageId}.jpeg`)) ||
    fs.existsSync(path.join(userPath, "captures", `${imageId}.png`)) ||
    fs.existsSync(path.join(userPath, `${imageId}.jpg`)) ||
    fs.existsSync(path.join(userPath, `${imageId}.jpeg`)) ||
    fs.existsSync(path.join(userPath, `${imageId}.png`));

  if (!captureExists && !readMeta(userPath, imageId)) {
    return res.status(404).json({ error: "image_not_found" });
  }

  const existing = findAiSelectionForImage(customer, imageId);
  if (existing?.status === "ready" && existing.outputPath) {
    const relativePath = String(existing.outputPath);
    const host = req.headers.host || PUBLIC_HOST;
    return res.json({
      jobId: existing.jobId || buildAiJobId(imageId, theme.id),
      status: "ready",
      imageId,
      themeId: theme.id,
      aiUrl: buildPublicImageUrl(todayFolder, user, relativePath, host),
      outputPath: relativePath,
      quota: readAiQuotaWithPending(userPath),
      aiThemeId: theme.id,
      aiThemeLabel: theme.label,
      aiThemeLocked: Boolean(customer.aiThemeLockedAt),
    });
  }

  if (
    existing &&
    ["pending", "queued", "processing"].includes(String(existing.status))
  ) {
    return res.json({
      jobId: existing.jobId || buildAiJobId(imageId, theme.id),
      status: existing.status,
      imageId,
      themeId: theme.id,
      phase: existing.phase ?? null,
      quota: readAiQuotaWithPending(userPath),
      aiThemeId: theme.id,
      aiThemeLabel: theme.label,
      aiThemeLocked: Boolean(customer.aiThemeLockedAt),
    });
  }

  try {
    reserveAiQuota(userPath);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === "quota_exhausted") {
      return res.status(409).json({ error: "quota_exhausted" });
    }
    return res.status(400).json({ error: code });
  }

  lockSessionTheme(userPath);

  const jobId = buildAiJobId(imageId, theme.id);
  const host = req.headers.host || PUBLIC_HOST;

  upsertAiSelection(userPath, {
    imageId,
    themeId: theme.id,
    jobId,
    status: "queued",
    phase: null,
    error: null,
    outputPath: null,
  });

  enqueueAiGenerationJob({
    user,
    userDir: userPath,
    imageId,
    themeId: theme.id,
    todayFolder,
    host,
    emitProgress: (payload) => io.emit("ai-generation-progress", payload),
    emitComplete: (payload) => io.emit("ai-generation-complete", payload),
  });

  res.status(202).json({
    jobId,
    status: "queued",
    imageId,
    themeId: theme.id,
    quota: readAiQuotaWithPending(userPath),
    queue: getAiQueueStats(),
    aiThemeId: theme.id,
    aiThemeLabel: theme.label,
    aiThemeLocked: true,
  });
});

app.get("/api/images/:user/:imageId/ai-status", (req, res) => {
  const { user, imageId } = req.params;
  const themeId = (req.query.themeId || "").toString();
  const jobId = (req.query.jobId || "").toString();

  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);

  if (!fs.existsSync(userPath)) {
    return res.status(404).json({ error: "not_found" });
  }

  const customer = readCustomerJson(userPath);
  let selection = null;

  if (jobId) {
    selection = findAiSelectionByJobId(userPath, jobId);
  } else {
    selection = findAiSelectionForImage(customer, imageId);
    if (themeId && selection?.themeId && selection.themeId !== themeId) {
      selection = undefined;
    }
  }

  if (!selection) {
    return res.status(404).json({ error: "not_found" });
  }

  const sessionTheme = readSessionTheme(customer);

  const host = req.headers.host || PUBLIC_HOST;
  const outputPath = selection.outputPath ? String(selection.outputPath) : null;

  res.json({
    jobId: selection.jobId,
    imageId: selection.imageId,
    themeId: selection.themeId,
    status: selection.status,
    phase: selection.phase ?? null,
    error: selection.error ?? null,
    aiUrl: outputPath
      ? buildPublicImageUrl(todayFolder, user, outputPath, host)
      : null,
    outputPath,
    quota: readAiQuotaWithPending(userPath),
    aiThemeId: sessionTheme.themeId,
    aiThemeLabel: sessionTheme.label,
    aiThemeLocked: sessionTheme.locked,
  });
});

// ======================
// SESSION MANAGEMENT
// ======================
app.get("/api/session", (req, res) => res.json({ activeSession, sessionLocked }));

app.post("/api/session/start", (req, res) => {
  const {
    user,
    duration,
    peopleCount,
    packageType: bodyPackageType,
  } = req.body;
  if (!user || !peopleCount)
    return res.status(400).json({ error: "user & peopleCount required" });

  const userFolder = getUserPathForToday(user);
  const customer = readCustomerJson(userFolder);
  const packageType = normalizePackageType(
    bodyPackageType ?? customer?.packageType ?? activeSession?.packageType
  );
  const durationMinutes =
    duration != null && !Number.isNaN(Number(duration))
      ? Number(duration)
      : getPackageDurationMinutes(packageType);

  activeSession = {
    user,
    peopleCount,
    packageType,
    endsAt: Date.now() + durationMinutes * 60 * 1000,
    pausedAt: null,
    remainingMs: null,
  };
  sessionLocked = false;
  io.emit("session-started", activeSession);
  res.json({ success: true, session: activeSession });
});

// ======================
// KIOSK FLOW CONTROL (TRIAL & MAIN SESSION)
// ======================
// Semua kontrol dipicu dari studio-kiosk, kiosk-app hanya mendengar event socket.

app.post("/api/kiosk/trial-start", (req, res) => {
  const { user, durationSeconds = 60 } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  if (!activeSession) return res.status(400).json({ error: "no active session" });

  const endsAt = Date.now() + durationSeconds * 1000;

  activeSession.endsAt = endsAt;
  activeSession.phase = "trial";

  const kioskFields = buildKioskSyncFields(user, {
    packageType: activeSession.packageType,
  });

  io.emit("kiosk-trial-start", {
    user,
    durationMs: durationSeconds * 1000,
    endsAt,
    ...kioskFields,
  });
  emitSessionTimerUpdate();

  res.json({ success: true, endsAt });
});

app.post("/api/kiosk/trial-skip", (req, res) => {
  const { user } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  io.emit("kiosk-trial-skip", { user });
  res.json({ success: true });
});

app.post("/api/kiosk/main-start", (req, res) => {
  const {
    user,
    durationSeconds,
    packageType: bodyPackageType,
  } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  if (!activeSession) return res.status(400).json({ error: "no active session" });

  const packageType = normalizePackageType(
    bodyPackageType ?? activeSession.packageType
  );
  const defaultSeconds = getPackageDurationMinutes(packageType) * 60;
  const resolvedSeconds =
    durationSeconds != null && !Number.isNaN(Number(durationSeconds))
      ? Number(durationSeconds)
      : defaultSeconds;

  const endsAt = Date.now() + resolvedSeconds * 1000;

  activeSession.endsAt = endsAt;
  activeSession.packageType = packageType;
  activeSession.phase = "main";

  const kioskFields = buildKioskSyncFields(user, { packageType });

  io.emit("kiosk-main-start", {
    user,
    durationMs: resolvedSeconds * 1000,
    endsAt,
    ...kioskFields,
  });
  emitSessionTimerUpdate();

  res.json({ success: true, endsAt });
});

/** Operator triggers synchronized countdown + shutter on customer display. */
app.post("/api/kiosk/trigger-capture", (req, res) => {
  const { user } = req.body || {};
  const sessionUser = user || activeSession?.user;
  if (!sessionUser) return res.status(400).json({ error: "user required" });
  if (!activeSession || sessionLocked) {
    return res.status(400).json({ error: "no active session" });
  }
  if (activeSession.user !== sessionUser) {
    return res.status(400).json({ error: "session_user_mismatch" });
  }

  io.emit("kiosk-capture-start", {
    user: sessionUser,
    countdownSeconds: CAPTURE_COUNTDOWN_SECONDS,
  });

  res.json({ success: true, countdownSeconds: CAPTURE_COUNTDOWN_SECONDS });
});

// Kiosk configuration for frontend (session duration, countdown, etc)
app.get("/api/kiosk-config", (_req, res) => {
  res.json({
    sessionDurationMinutes: SESSION_DURATION_MINUTES,
    captureCountdownSeconds: CAPTURE_COUNTDOWN_SECONDS,
    trialDurationSeconds: TRIAL_DURATION_SECONDS,
    packageDurations: PACKAGE_DURATIONS,
    packages: PACKAGE_TYPES,
    aiSelfPhoto: getAiGenerationConfig(),
  });
});

app.post("/api/session/pause", (req, res) => {
  if (!activeSession || activeSession.pausedAt)
    return res.status(400).json({ error: "No active session or already paused" });

  activeSession.remainingMs = activeSession.endsAt - Date.now();
  activeSession.pausedAt = Date.now();

  io.emit("session-paused", { remainingMs: activeSession.remainingMs });
  emitSessionTimerUpdate();
  res.json({ success: true });
});

app.post("/api/session/resume", (req, res) => {
  if (!activeSession || !activeSession.pausedAt)
    return res.status(400).json({ error: "Session not paused" });

  activeSession.endsAt = Date.now() + activeSession.remainingMs;
  activeSession.pausedAt = null;
  activeSession.remainingMs = null;

  io.emit("session-resumed", activeSession);
  emitSessionTimerUpdate();
  res.json({ success: true, session: activeSession });
});

app.post("/api/session/add-time", (req, res) => {
  const { minutes = 1 } = req.body;
  if (!activeSession) return res.status(400).json({ error: "No active session" });

  const extraMs = minutes * 60 * 1000;
  if (activeSession.pausedAt) {
    activeSession.remainingMs += extraMs;
    io.emit("session-paused", { remainingMs: activeSession.remainingMs });
  } else {
    activeSession.endsAt += extraMs;
    io.emit("session-resumed", activeSession);
  }
  emitSessionTimerUpdate();

  res.json({ success: true });
});

app.post("/api/session/stop", (req, res) => {
  activeSession = null;
  sessionLocked = true;
  io.emit("session-ended");
  res.json({ success: true });
});

// Auto-end session
setInterval(() => {
  if (activeSession && !activeSession.pausedAt && Date.now() > activeSession.endsAt) {
    activeSession = null;
    sessionLocked = true;
    io.emit("session-ended");
  }
}, 1000);

// ======================
// PRINT LIMIT
// ======================
app.get("/api/print-limit", (req, res) => {
  if (!activeSession) return res.json({ allowedPrint: 0 });

  const people = activeSession.peopleCount;
  let allowedPrint = 2;
  if (people === 2) allowedPrint = 3;
  if (people >= 3) allowedPrint = 5;

  res.json({ allowedPrint });
});

// ======================
// CAPTURE ENDPOINT (optional camera trigger)
// ======================
// This lets the kiosk app ask the backend to run a configurable
// command that triggers the Sony camera shutter via vendor software.
// Configure via CAMERA_CAPTURE_COMMAND env, e.g. a .cmd or .bat file.

const CAMERA_CAPTURE_COMMAND = process.env.CAMERA_CAPTURE_COMMAND || null;

app.post("/api/capture", (req, res) => {
  if (!CAMERA_CAPTURE_COMMAND) {
    return res.status(500).json({ error: "CAMERA_CAPTURE_COMMAND not configured" });
  }

  const user = req.body?.user || activeSession?.user || "anonymous";

  const command = CAMERA_CAPTURE_COMMAND.replace(/\$USER/g, user);

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error("Camera capture command failed:", err, stderr);
      return res.status(500).json({ error: "capture_failed" });
    }
    res.json({ success: true });
  });
});

// Dev-only: kiosk posts a webcam frame; API drops it into capture/ for the chokidar pipeline.
const DEV_WEBCAM_CAPTURE = process.env.DEV_WEBCAM_CAPTURE === "true";

app.post("/api/capture/webcam", (req, res) => {
  if (!DEV_WEBCAM_CAPTURE) {
    return res.status(403).json({ error: "dev_webcam_disabled" });
  }

  upload.single("file")(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "file_too_large" });
      }
      if (uploadErr.message === "invalid_file_type") {
        return res.status(400).json({ error: "invalid_file_type" });
      }
      return res.status(400).json({ error: "upload_failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "file_required" });
    }

    try {
      const filename = `webcam-${Date.now()}.jpg`;
      const destPath = path.join(CAPTURE_DIR, filename);
      fs.writeFileSync(destPath, req.file.buffer);
      res.json({ success: true, filename, path: destPath });
    } catch (err) {
      console.error("Webcam capture save failed:", err);
      res.status(500).json({ error: "capture_failed" });
    }
  });
});

// ======================
// GET IMAGES
// ======================
app.get("/api/images/:user", (req, res) => {
  const { user } = req.params;
  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);

  if (!fs.existsSync(userPath)) return res.json({ images: [] });

  const host = req.headers.host;
  const images = listUserImages(userPath, host, todayFolder, user);

  res.json({ images });
});

app.get("/api/images/:user/:imageId/status", (req, res) => {
  const { user, imageId } = req.params;
  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);

  if (!fs.existsSync(userPath)) {
    return res.status(404).json({ error: "not_found" });
  }

  const meta = readMeta(userPath, imageId);
  if (!meta) {
    return res.status(404).json({ error: "not_found" });
  }

  const host = req.headers.host;
  res.json({
    imageId,
    status: meta.status ?? PROCESSING_STATUS.NONE,
    variants: buildVariantUrls(host, todayFolder, user, meta),
  });
});

app.post("/api/images/:user/upload", (req, res) => {
  upload.single("file")(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "file_too_large" });
      }
      if (uploadErr.message === "invalid_file_type") {
        return res.status(400).json({ error: "invalid_file_type" });
      }
      return res.status(400).json({ error: "upload_failed" });
    }

    const { user } = req.params;
    const todayFolder = getTodayFolder();
    const userPath = getUserPathForToday(user);

    if (!req.file) {
      return res.status(400).json({ error: "file_required" });
    }

    try {
      if (!fs.existsSync(userPath)) {
        fs.mkdirSync(userPath, { recursive: true });
      }

      const { imageId, destPath, sourceFilename, ext } = saveUploadedToCaptures(
        userPath,
        req.file.buffer,
        req.file.originalname
      );

      createPendingMeta({
        userDir: userPath,
        imageId,
        sourceFilename,
        ext,
        status: PROCESSING_STATUS.NONE,
      });

      io.emit("new-photo", {
        user,
        imageId,
        filename: path.basename(destPath),
        fullPath: destPath,
      });

      res.status(201).json({
        success: true,
        imageId,
        originalUrl: buildPublicImageUrl(
          todayFolder,
          user,
          path.join("captures", path.basename(destPath)),
          req.headers.host
        ),
        status: PROCESSING_STATUS.NONE,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      res.status(500).json({ error: "upload_failed" });
    }
  });
});

// API to get headline gallery
app.get("/api/headline", (req, res) => {
  const headlineDir = path.join(BASE_DIR, "headline");

  if (!fs.existsSync(headlineDir)) return res.json({ headlines: [] });

  const host = req.headers.host;
  const headlines = fs
    .readdirSync(headlineDir)
    .filter((f) => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .map((filename) => ({
      filename,
      url: `http://${host}/headline/${filename}`,
    }));

  res.json({ headlines });
});

// ======================
// APPLY TEMPLATE
// ======================
async function applyTemplate(imagePath, outputPath, customer, template) {
  let img = sharp(imagePath).resize(template.size.width, template.size.height);

  if (template.logo) {
    img = img.composite([
      { input: path.join(__dirname, "logos", template.logo.path), left: template.logo.x, top: template.logo.y },
    ]);
  }

  if (template.text) {
    const svg = `
      <svg width="${template.size.width}" height="200">
        <text x="${template.text.x}" y="${template.text.y}"
          font-size="${template.text.fontSize}"
          fill="${template.text.color}"
          text-anchor="middle">
          ${customer.name}
        </text>
      </svg>`;
    img = img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
  }

  await img.toFile(outputPath);
}

// ======================
// PRINT PDF 4R
// ======================
function silentPrint(filePath, printerName = null) {
  const sumatraPath = `"C:\\Users\\khairus\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe"`;

  // Command untuk print silent
  const command = printerName
    ? `${sumatraPath} -print-to "${printerName}" "${filePath}"` // printer spesifik
    : `${sumatraPath} -print-to-default "${filePath}"`; // printer default

  exec(command, (err) => {
    if (err) console.error("Silent print error:", err);
  });
}

app.post("/api/print", async (req, res) => {
  const {
    images,
    printerName,
    templateId = "4R",
    layoutType = "classic",
    pageWidthPx,
    pageHeightPx,
    paperId,
    recipeId,
    recipeLabel,
    slotCount,
    peopleCount,
    copies: copiesFromBody,
  } = req.body;

  if (!Array.isArray(images) || images.length === 0)
    return res.status(400).json({ error: "No images" });

  const isSheetPrint = layoutType === "sheet";

  if (isSheetPrint) {
    console.log(
      `[print] sheet ${paperId ?? "?"} · ${recipeLabel ?? recipeId ?? "custom"} · ${slotCount ?? "?"} slots · ${images.length} page(s)`
    );
  }

  // Folder print
  const printDir = path.join(BASE_DIR, "print");
  if (!fs.existsSync(printDir)) fs.mkdirSync(printDir, { recursive: true });

  // Tentukan ukuran PDF sesuai template atau sheet
  let widthPx = 6 * 300; // default 4R Landscape
  let heightPx = 4 * 300;

  if (isSheetPrint) {
    if (!pageWidthPx || !pageHeightPx) {
      return res
        .status(400)
        .json({ error: "Sheet print requires pageWidthPx and pageHeightPx" });
    }
    widthPx = Math.round(Number(pageWidthPx));
    heightPx = Math.round(Number(pageHeightPx));
  }

  const pdfWidthPt = pxToPt(widthPx);
  const pdfHeightPt = pxToPt(heightPx);

  // PDF path
  const pdfPath = path.join(printDir, `print-${Date.now()}.pdf`);
  const doc = new PDFDocument({ autoFirstPage: false });
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // ICC profile path
  const iccPath = path.join(__dirname, "profiles", "sRGB-v4.icc");
  const hasIcc = fs.existsSync(iccPath);

  // Tentukan jumlah copy: body → session → peopleCount → 1
  let copies = 1;
  if (
    copiesFromBody != null &&
    Number.isFinite(Number(copiesFromBody)) &&
    Number(copiesFromBody) > 0
  ) {
    copies = Math.min(10, Math.round(Number(copiesFromBody)));
  } else if (peopleCount != null) {
    copies = copiesForPeopleCount(peopleCount);
  } else if (activeSession?.peopleCount) {
    copies = copiesForPeopleCount(activeSession.peopleCount);
  }

  try {
    for (const imgData of images) {
      const buffer = Buffer.from(imgData.replace(/^data:image\/png;base64,/, ""), "base64");

      // Proses gambar dengan Sharp
      let processedBuffer = sharp(buffer).rotate();

      if (isSheetPrint) {
        const sheetMeta = await sharp(buffer).metadata();
        let sheetPipeline = sharp(buffer).rotate();

        if (sheetMeta.width !== widthPx || sheetMeta.height !== heightPx) {
          console.warn(
            `[print] sheet page resized ${sheetMeta.width}x${sheetMeta.height} -> ${widthPx}x${heightPx}`
          );
          sheetPipeline = sheetPipeline.resize(widthPx, heightPx, {
            fit: "fill",
          });
        }

        processedBuffer = await sheetPipeline
          .withMetadata({ density: 300, ...(hasIcc ? { icc: iccPath } : {}) })
          .jpeg({ quality: 100 })
          .toBuffer();
      } else {
        if (templateId === "4R_FULL") {
          processedBuffer = processedBuffer.rotate(90);
        }

        processedBuffer = await processedBuffer
          .resize(widthPx, heightPx, { fit: "cover", position: "centre" })
          .withMetadata({ density: 300, ...(hasIcc ? { icc: iccPath } : {}) })
          .jpeg({ quality: 100 })
          .toBuffer();
      }

      // Tambahkan page di PDF
      doc.addPage({ size: [pdfWidthPt, pdfHeightPt] });
      doc.image(processedBuffer, 0, 0, { width: pdfWidthPt, height: pdfHeightPt });
    }

    doc.end();

    writeStream.on("finish", () => {
      // Print sesuai jumlah copy
      for (let i = 0; i < copies; i++) {
        silentPrint(pdfPath, printerName);
      }

      // Auto-delete PDF 1 menit setelah print
      setTimeout(() => {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      }, 60_000);

      res.json({ success: true, file: pdfPath, copies });
    });

    writeStream.on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "PDF generation failed" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image processing failed" });
  }
});


// ======================
// WATCH FOLDER CAPTURE → USER FOLDER (TANPA AUTO PRINT)
// ======================
// Pantau hanya folder "capture" (output Imaging Edge), pindahkan
// ke folder tanggal/user aktif, lalu emit event untuk front-end.
chokidar
  .watch(CAPTURE_DIR, { persistent: true })
  .on("add", async (filePath) => {
    if (!filePath.match(/\.(jpg|jpeg|png)$/i)) return;
    if (!activeSession || sessionLocked) return;

    try {
      const todayFolder = getTodayFolder();
      const userSlug = activeSession.user;
      const userFolder = path.join(BASE_DIR, todayFolder, userSlug);
      if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

      const { imageId, destPath, sourceFilename, ext } = saveOriginalFromCapture(
        userFolder,
        filePath
      );

      createPendingMeta({
        userDir: userFolder,
        imageId,
        sourceFilename,
        ext,
        status: PROCESSING_STATUS.NONE,
      });

      io.emit("new-photo", {
        user: userSlug,
        imageId,
        filename: path.basename(destPath),
        fullPath: destPath,
      });
    } catch (err) {
      console.error("Image processing failed:", err);
    }
  });


// ======================
// SOCKET
// ======================
io.on("connection", (socket) => {
  console.log("🟢 Kiosk connected");
  socket.emit("session-state", {
    activeSession,
    sessionLocked,
    timer: buildSessionTimerUpdate(activeSession),
  });
});

// ======================
// START SERVER
// ======================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running http://localhost:${PORT}`);
  console.log(`📁 BASE_DIR: ${BASE_DIR}`);
  console.log(`🌐 Public host: ${PUBLIC_HOST}`);
  console.log(`📸 Packages: ${PACKAGE_TYPES.join(", ")}`);
  console.log(
    `🤖 AI Self Photo: ${getAiPipelineStatus().enabled ? "enabled" : "disabled"} (pipeline=${getAiPipelineStatus().pipeline}, OpenAI: ${getAiPipelineStatus().openaiConfigured ? "yes" : "no"}, segmentation: ${getAiPipelineStatus().personSegmentation?.enabled ? getAiPipelineStatus().personSegmentation.assetsFound ? "ready" : "assets-missing" : "off"}, face-refine: ${getAiPipelineStatus().faceRefine?.available ? "on" : getAiPipelineStatus().faceRefine?.enabled ? "assets-missing" : "off"})`
  );
  console.log(`❤️  Health: GET /api/health · GET /api/health/image-processing`);
  console.log(`📦 Promo Tools: GET /api/promo-tools/products · GET /api/promo-tools/orders`);
  console.log(
    `🧪 AI Theme Research: ${isAdminApiEnabled() ? "enabled (ADMIN_API_TOKEN set)" : "disabled — set ADMIN_API_TOKEN"}`
  );
  if (isAdminApiEnabled()) {
    console.log(`   GET /api/admin/ai-theme-research/meta · POST .../preview · POST .../publish`);
  }

  prewarmPersonSegmentation().catch(() => {});
});
