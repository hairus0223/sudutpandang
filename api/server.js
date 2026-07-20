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
  ingestLegacyPhoto,
  readMeta,
  saveOriginalFromCapture,
  saveUploadedToCaptures,
  updateStatus,
} from "./services/imageStorage.js";
import {
  normalizePassportColor,
  readCustomerJson,
  readCustomerLookId,
  readCustomerPackageType,
  readCustomerThemeId,
  readPassportBackgroundColor,
  writeCustomerLookId,
} from "./services/customerConfig.js";
import {
  LOOK_PRESETS,
  defaultLookForPackage,
  normalizeLookId,
} from "./services/lookPresets.js";
import {
  enqueueApplyPassportBg,
  enqueueApplyTheme,
  enqueueRemoveBackground,
  imageProcessingQueue,
  recoverIncompletePassportJobs,
  recoverIncompleteThemeJobs,
  recoverPendingJobs,
} from "./services/imageProcessingQueue.js";
import {
  BG_REMOVAL_ENABLED,
  BG_REMOVAL_PREWARM,
  checkBackgroundRemovalHealth,
  getRemovalModel,
  prewarmBackgroundRemoval,
  validateBackgroundRemovalAssets,
} from "./services/backgroundRemoval.js";
import { THEME_GENERATION_ENABLED } from "./services/themeGeneration.js";
import {
  listThemeCategoriesForApi,
  listThemesForApi,
  normalizeThemeId,
  resolveDefaultThemeId,
  validateClassicThemeAssets,
  validateWorldCupThemeAssets,
} from "./services/themePresets.js";
import { getThemeSourceStats } from "./services/themeSourceStats.js";
import {
  DEFAULT_PASSPORT_SIZE_ID,
  normalizePassportSizeId,
  PASSPORT_SIZE_PRESETS,
} from "./services/passportSizes.js";
import { bootstrapStudioDirs, resolveBaseDir } from "./services/studioPaths.js";
import {
  getPublicStudioConfig,
  logStartupValidation,
  validateStudioConfig,
} from "./services/studioConfig.js";
import {
  checkManualProcessAllowed,
  getProcessRateLimitConfig,
} from "./services/processRateLimit.js";
import { initPromoToolsDb } from "./services/promo-tools/db.js";
import { resolvePromoToolsUploadDir } from "./services/promo-tools/paths.js";
import { createPromoToolsRouter } from "./routes/promo-tools/index.js";

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

// Folder INPUT dari Imaging Edge
const CAPTURE_DIR = path.join(BASE_DIR, "capture");

// ======================
// __dirname fix untuk ES Module
// ======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  if (meta?.variants?.subject) {
    variants.subject = buildPublicImageUrl(
      todayFolder,
      userSlug,
      String(meta.variants.subject),
      host
    );
  }

  if (meta?.status === PROCESSING_STATUS.READY && meta?.variants?.passport) {
    variants.passport = buildPublicImageUrl(
      todayFolder,
      userSlug,
      String(meta.variants.passport),
      host
    );
  }

  if (meta?.status === PROCESSING_STATUS.READY && meta?.variants?.themed) {
    variants.themed = buildPublicImageUrl(
      todayFolder,
      userSlug,
      String(meta.variants.themed),
      host
    );
  }

  return variants;
}

function getUserPathForToday(userSlug) {
  return path.join(BASE_DIR, getTodayFolder(), userSlug);
}

function readCustomerSessionMeta(userSlug) {
  const userFolder = getUserPathForToday(userSlug);
  const data = readCustomerJson(userFolder);
  if (!data) return null;

  const packageType = data.packageType || "self-photo";
  return {
    packageType,
    passportBackgroundColor: normalizePassportColor(data.passportBackgroundColor),
    passportSizeId: normalizePassportSizeId(data.passportSizeId),
    themeId: normalizeThemeId(data.themeId),
    lookId: normalizeLookId(data.lookId, packageType),
  };
}

/**
 * Package/theme/look fields for kiosk socket sync (customer.json is source of truth).
 * @param {string} userSlug
 * @param {{ packageType?: string }} [fallback]
 */
function buildKioskSyncFields(userSlug, fallback = {}) {
  const customerMeta = readCustomerSessionMeta(userSlug);
  const packageType =
    customerMeta?.packageType ?? fallback.packageType ?? "self-photo";

  return {
    packageType,
    passportSizeId:
      customerMeta?.passportSizeId ?? DEFAULT_PASSPORT_SIZE_ID,
    themeId: customerMeta?.themeId ?? null,
    lookId:
      customerMeta?.lookId ?? defaultLookForPackage(packageType),
  };
}

const PACKAGES_WITH_AUTO_BG = new Set(["ai-photo", "pas-photo"]);

function shouldAutoRemoveBackground(packageType) {
  return PACKAGES_WITH_AUTO_BG.has(packageType || "self-photo");
}

function scheduleBackgroundRemoval({
  userFolder,
  userSlug,
  imageId,
  todayFolder,
  packageType,
  passportColor,
  themeId,
  lookId,
  force = false,
}) {
  if (!BG_REMOVAL_ENABLED) return;

  const resolvedPackageType =
    packageType ?? readCustomerPackageType(userFolder);
  if (!force && !shouldAutoRemoveBackground(resolvedPackageType)) return;

  const resolvedPassportColor =
    passportColor ?? readPassportBackgroundColor(userFolder);
  const resolvedThemeId = themeId ?? readCustomerThemeId(userFolder);
  const resolvedLookId = lookId ?? readCustomerLookId(userFolder);

  enqueueRemoveBackground({
    userDir: userFolder,
    imageId,
    user: userSlug,
    packageType: resolvedPackageType,
    passportColor: resolvedPassportColor,
    themeId: resolvedThemeId,
    lookId: resolvedLookId,
    onComplete: (result) => {
      emitPhotoProcessed({
        user: userSlug,
        imageId,
        status: "ready",
        todayFolder,
        meta: result?.meta,
      });
    },
    onError: (err) => {
      emitPhotoProcessed({
        user: userSlug,
        imageId,
        status: "failed",
        todayFolder,
        error: err.message,
      });
    },
  });
}

function scheduleThemeGeneration({
  userFolder,
  userSlug,
  imageId,
  todayFolder,
  themeId,
  lookId,
}) {
  const resolvedThemeId = themeId ?? readCustomerThemeId(userFolder);
  const resolvedLookId = lookId ?? readCustomerLookId(userFolder);

  enqueueApplyTheme({
    userDir: userFolder,
    imageId,
    user: userSlug,
    themeId: resolvedThemeId,
    lookId: resolvedLookId,
    onComplete: (result) => {
      emitPhotoProcessed({
        user: userSlug,
        imageId,
        status: "ready",
        todayFolder,
        meta: result?.meta,
      });
    },
    onError: (err) => {
      emitPhotoProcessed({
        user: userSlug,
        imageId,
        status: "failed",
        todayFolder,
        error: err.message,
      });
    },
  });
}

function schedulePassportBackground({
  userFolder,
  userSlug,
  imageId,
  todayFolder,
  passportColor,
}) {
  const resolvedPassportColor =
    passportColor ?? readPassportBackgroundColor(userFolder);

  enqueueApplyPassportBg({
    userDir: userFolder,
    imageId,
    user: userSlug,
    passportColor: resolvedPassportColor,
    onComplete: (result) => {
      emitPhotoProcessed({
        user: userSlug,
        imageId,
        status: "ready",
        todayFolder,
        meta: result?.meta,
      });
    },
    onError: (err) => {
      emitPhotoProcessed({
        user: userSlug,
        imageId,
        status: "failed",
        todayFolder,
        error: err.message,
      });
    },
  });
}

function listUserImages(userPath, host, todayFolder, userSlug) {
  const images = [];

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
        processingStatus: meta?.status ?? "pending",
        processingPhase: meta?.processingPhase ?? null,
        processingError: meta?.error ?? null,
        themeBackgroundSource: meta?.pipeline?.themeBackgroundSource ?? null,
        bakedLookId: meta?.pipeline?.bakedLookId ?? null,
        variants,
      });
    }
  }

  return images.sort((a, b) => a.filename.localeCompare(b.filename));
}

function emitPhotoProcessed({ user, imageId, status, todayFolder, meta, error }) {
  const payload = { user, imageId, status };
  if (status === "ready" && meta?.variants?.themed) {
    payload.themedUrl = buildPublicImageUrl(
      todayFolder,
      user,
      String(meta.variants.themed)
    );
  }
  if (status === "ready" && meta?.variants?.passport) {
    payload.passportUrl = buildPublicImageUrl(
      todayFolder,
      user,
      String(meta.variants.passport)
    );
  }
  if (status === "ready" && meta?.variants?.subject) {
    payload.subjectUrl = buildPublicImageUrl(
      todayFolder,
      user,
      String(meta.variants.subject)
    );
  }
  if (status === "ready" && meta?.pipeline?.bakedLookId) {
    payload.bakedLookId = meta.pipeline.bakedLookId;
  }
  if (status === "failed" && error) {
    payload.error = error;
  }
  io.emit("photo-processed", payload);
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
  "/promo-tools/files",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(resolvePromoToolsUploadDir(BASE_DIR))
);

app.use("/api/promo-tools", createPromoToolsRouter({ publicHost: PUBLIC_HOST }));

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

const PACKAGE_DURATIONS = {
  "self-photo": SESSION_DURATION_MINUTES,
  "pas-photo": 5,
  "ai-photo": SESSION_DURATION_MINUTES,
};

function buildSessionTimerUpdate(session) {
  if (!session) return null;

  const kioskFields = buildKioskSyncFields(session.user, {
    packageType: session.packageType,
  });

  return {
    user: session.user,
    endsAt: session.endsAt,
    pausedAt: session.pausedAt,
    remainingMs: session.pausedAt
      ? session.remainingMs
      : Math.max(0, session.endsAt - Date.now()),
    phase: session.phase ?? null,
    packageType: kioskFields.packageType,
    passportSizeId: kioskFields.passportSizeId,
    themeId: kioskFields.themeId,
    lookId: kioskFields.lookId,
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
    packageType = "self-photo",
    passportBackgroundColor,
    passportSizeId,
    themeId,
    lookId,
  } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "")
    return res.status(400).json({ error: "invalid data" });

  const people = Math.max(1, Math.min(8, Number(peopleCount) || 1));
  const slugName = name.trim().replace(/\s+/g, "_");
  const todayFolder = getTodayFolder();
  const userFolder = path.join(BASE_DIR, todayFolder, slugName);

  const customerData = {
    name: name.trim(),
    phone: typeof phone === "string" ? phone.trim() : "",
    peopleCount: people,
    user: slugName,
    templateId,
    packageType,
    passportBackgroundColor:
      packageType === "pas-photo"
        ? normalizePassportColor(passportBackgroundColor)
        : null,
    passportSizeId:
      packageType === "pas-photo"
        ? normalizePassportSizeId(passportSizeId)
        : null,
    themeId:
      packageType === "ai-photo" ? normalizeThemeId(themeId) : null,
    lookId:
      packageType === "pas-photo"
        ? "natural"
        : normalizeLookId(lookId, packageType),
    printLimit: people,
    folderPath: `/images/${todayFolder}/${slugName}`,
    registeredAt: new Date().toISOString(),
  };

  fs.mkdirSync(userFolder, { recursive: true });
  fs.writeFileSync(
    path.join(userFolder, "customer.json"),
    JSON.stringify(customerData, null, 2)
  );

  res.json({ success: true, customer: customerData });
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
  res.json({ success: true, customer: data });
});

app.get("/api/print-config/:user", (req, res) => {
  const { user } = req.params;
  const todayFolder = getTodayFolder();
  const file = path.join(BASE_DIR, todayFolder, user, "customer.json");

  if (!fs.existsSync(file)) return res.status(404).json({ error: "not found" });

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  const packageType = data.packageType || "self-photo";
  res.json({
    allowedPrint: data.printLimit,
    peopleCount: data.peopleCount ?? 1,
    printCopies: copiesForPeopleCount(data.peopleCount ?? 1),
    templateId: data.templateId,
    name: data.name,
    packageType,
    passportBackgroundColor: normalizePassportColor(data.passportBackgroundColor),
    passportSizeId: normalizePassportSizeId(data.passportSizeId),
    themeId: normalizeThemeId(data.themeId),
    lookId: normalizeLookId(data.lookId, packageType),
  });
});

app.get("/api/looks", (_req, res) => {
  res.json({
    looks: LOOK_PRESETS,
    defaultIntensity: 0.6,
  });
});

app.get("/api/passport-sizes", (_req, res) => {
  res.json({
    sizes: PASSPORT_SIZE_PRESETS.map(({ id, label, widthMm, heightMm }) => ({
      id,
      label,
      widthMm,
      heightMm,
    })),
    defaultSizeId: DEFAULT_PASSPORT_SIZE_ID,
  });
});

app.get("/api/themes", (_req, res) => {
  res.json({
    defaultThemeId: resolveDefaultThemeId(),
    themes: listThemesForApi(),
    categories: listThemeCategoriesForApi(),
  });
});

app.get("/api/health", async (_req, res) => {
  const backgroundRemoval = await checkBackgroundRemovalHealth();
  const queue = {
    pending: imageProcessingQueue.pendingCount,
    queued: imageProcessingQueue.queuedCount,
    processing: imageProcessingQueue.isProcessing,
  };

  const themeSourceStats = getThemeSourceStats();
  const ok =
    STARTUP_VALIDATION.ok &&
    (!BG_REMOVAL_ENABLED || backgroundRemoval.ok) &&
    STUDIO_PUBLIC_CONFIG.bundledThemeAssetsReady;

  res.status(ok ? 200 : 503).json({
    ok,
    uptimeSec: Math.floor(process.uptime()),
    config: STUDIO_PUBLIC_CONFIG,
    validation: {
      warnings: STARTUP_VALIDATION.warnings,
      errors: STARTUP_VALIDATION.errors,
    },
    backgroundRemoval,
    themeGenerationEnabled: THEME_GENERATION_ENABLED,
    themeSourceStats,
    queue,
    rateLimit: getProcessRateLimitConfig(),
  });
});

app.get("/api/health/image-processing", async (req, res) => {
  const deep = req.query.deep === "1" || req.query.deep === "true";
  const backgroundRemoval = await checkBackgroundRemovalHealth({ deep });
  const queue = {
    pending: imageProcessingQueue.pendingCount,
    queued: imageProcessingQueue.queuedCount,
    processing: imageProcessingQueue.isProcessing,
  };

  const ok =
    (!BG_REMOVAL_ENABLED || backgroundRemoval.ok) &&
    STUDIO_PUBLIC_CONFIG.bundledThemeAssetsReady;

  res.status(ok ? 200 : 503).json({
    ok,
    backgroundRemoval,
    themeGenerationEnabled: THEME_GENERATION_ENABLED,
    themeSourceStats: getThemeSourceStats(),
    config: {
      wc2026AssetsReady: STUDIO_PUBLIC_CONFIG.wc2026AssetsReady,
      classicAssetsReady: STUDIO_PUBLIC_CONFIG.classicAssetsReady,
      bundledThemeAssetsReady: STUDIO_PUBLIC_CONFIG.bundledThemeAssetsReady,
      externalThemeApiConfigured:
        STUDIO_PUBLIC_CONFIG.externalThemeApiConfigured,
      themeBackgroundCache: STUDIO_PUBLIC_CONFIG.themeBackgroundCache,
    },
    queue,
  });
});

// ======================
// SESSION MANAGEMENT
// ======================
app.get("/api/session", (req, res) => res.json({ activeSession, sessionLocked }));

app.post("/api/session/start", (req, res) => {
  const { user, duration = SESSION_DURATION_MINUTES, peopleCount, packageType } = req.body;
  if (!user || !peopleCount)
    return res.status(400).json({ error: "user & peopleCount required" });

  activeSession = {
    user,
    peopleCount,
    packageType: packageType || "self-photo",
    endsAt: Date.now() + duration * 60 * 1000,
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
    packageType: kioskFields.packageType,
    passportSizeId: kioskFields.passportSizeId,
    themeId: kioskFields.themeId,
    lookId: kioskFields.lookId,
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
    durationSeconds = SESSION_DURATION_MINUTES * 60,
    packageType = "self-photo",
  } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });
  if (!activeSession) return res.status(400).json({ error: "no active session" });

  const endsAt = Date.now() + durationSeconds * 1000;

  activeSession.endsAt = endsAt;
  activeSession.packageType = packageType;
  activeSession.phase = "main";

  const kioskFields = buildKioskSyncFields(user, { packageType });

  io.emit("kiosk-main-start", {
    user,
    durationMs: durationSeconds * 1000,
    endsAt,
    packageType: kioskFields.packageType,
    passportSizeId: kioskFields.passportSizeId,
    themeId: kioskFields.themeId,
    lookId: kioskFields.lookId,
  });
  emitSessionTimerUpdate();

  res.json({ success: true, endsAt });
});

/** Soft look preset — customer or operator; persists to customer.json + socket sync. */
app.post("/api/kiosk/look", (req, res) => {
  const { user, lookId } = req.body || {};
  if (!user) return res.status(400).json({ error: "user required" });

  const userFolder = getUserPathForToday(user);
  if (!fs.existsSync(userFolder)) {
    return res.status(404).json({ error: "customer not found" });
  }

  const packageType = readCustomerPackageType(userFolder);
  const resolved = writeCustomerLookId(userFolder, lookId, packageType);

  const payload = {
    user,
    lookId: resolved,
    packageType,
  };
  io.emit("kiosk-look-update", payload);
  emitSessionTimerUpdate();

  res.json({ success: true, ...payload });
});

// Kiosk configuration for frontend (session duration, countdown, etc)
app.get("/api/kiosk-config", (req, res) => {
  res.json({
    sessionDurationMinutes: SESSION_DURATION_MINUTES,
    captureCountdownSeconds: CAPTURE_COUNTDOWN_SECONDS,
    trialDurationSeconds: TRIAL_DURATION_SECONDS,
    packageDurations: PACKAGE_DURATIONS,
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
    status: meta.status,
    processingPhase: meta.processingPhase ?? null,
    variants: buildVariantUrls(host, todayFolder, user, meta),
    error: meta.error ?? null,
    themeBackgroundSource: meta.pipeline?.themeBackgroundSource ?? null,
    bakedLookId: meta.pipeline?.bakedLookId ?? null,
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

      const packageType = readCustomerPackageType(userPath);
      const autoRemoveBg = shouldAutoRemoveBackground(packageType);

      createPendingMeta({
        userDir: userPath,
        imageId,
        sourceFilename,
        ext,
        status: autoRemoveBg
          ? PROCESSING_STATUS.PENDING
          : PROCESSING_STATUS.NONE,
      });

      io.emit("new-photo", {
        user,
        imageId,
        filename: path.basename(destPath),
        fullPath: destPath,
      });

      scheduleBackgroundRemoval({
        userFolder: userPath,
        userSlug: user,
        imageId,
        todayFolder,
        packageType,
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
        status: autoRemoveBg
          ? PROCESSING_STATUS.PENDING
          : PROCESSING_STATUS.NONE,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      res.status(500).json({ error: "upload_failed" });
    }
  });
});

app.post("/api/images/:user/:imageId/process", (req, res) => {
  const { user, imageId } = req.params;
  const { operation = "remove-bg", color, themeId } = req.body ?? {};

  if (
    operation !== "remove-bg" &&
    operation !== "apply-passport-bg" &&
    operation !== "apply-theme"
  ) {
    return res.status(400).json({ error: "unsupported_operation" });
  }

  const todayFolder = getTodayFolder();
  const userPath = path.join(BASE_DIR, todayFolder, user);

  if (!fs.existsSync(userPath)) {
    return res.status(404).json({ error: "not_found" });
  }

  const rateCheck = checkManualProcessAllowed(user, () =>
    imageProcessingQueue.countJobsForUserDir(userPath)
  );

  if (!rateCheck.allowed) {
    return res.status(rateCheck.status).json({
      error: rateCheck.error,
      message: rateCheck.message,
    });
  }

  const passportColor = color ? normalizePassportColor(color) : undefined;
  const resolvedThemeId = themeId ? normalizeThemeId(themeId) : undefined;

  if (operation === "apply-theme") {
    const meta = readMeta(userPath, imageId);
    if (!meta) {
      return res.status(404).json({ error: "not_found" });
    }

    updateStatus(userPath, imageId, PROCESSING_STATUS.PENDING, {
      error: null,
      processingPhase: "apply-theme",
    });

    scheduleThemeGeneration({
      userFolder: userPath,
      userSlug: user,
      imageId,
      todayFolder,
      themeId: resolvedThemeId,
    });

    return res.json({
      success: true,
      imageId,
      status: PROCESSING_STATUS.PENDING,
    });
  }

  if (operation === "apply-passport-bg") {
    const meta = readMeta(userPath, imageId);
    if (!meta) {
      return res.status(404).json({ error: "not_found" });
    }

    updateStatus(userPath, imageId, PROCESSING_STATUS.PENDING, {
      error: null,
      processingPhase: "apply-passport-bg",
    });

    schedulePassportBackground({
      userFolder: userPath,
      userSlug: user,
      imageId,
      todayFolder,
      passportColor,
    });

    return res.json({
      success: true,
      imageId,
      status: PROCESSING_STATUS.PENDING,
    });
  }

  let meta = readMeta(userPath, imageId);
  if (!meta) {
    const ingested = ingestLegacyPhoto(userPath, imageId);
    if (!ingested) {
      return res.status(404).json({ error: "not_found" });
    }
    meta = readMeta(userPath, imageId);
  } else {
    updateStatus(userPath, imageId, PROCESSING_STATUS.PENDING, {
      error: null,
      processingPhase: "remove-bg",
    });
  }

  scheduleBackgroundRemoval({
    userFolder: userPath,
    userSlug: user,
    imageId,
    todayFolder,
    force: true,
    passportColor,
    themeId: resolvedThemeId,
  });

  res.json({
    success: true,
    imageId,
    status: PROCESSING_STATUS.PENDING,
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

      const packageType =
        activeSession.packageType ||
        readCustomerPackageType(userFolder) ||
        "self-photo";
      const autoRemoveBg = shouldAutoRemoveBackground(packageType);

      createPendingMeta({
        userDir: userFolder,
        imageId,
        sourceFilename,
        ext,
        status: autoRemoveBg
          ? PROCESSING_STATUS.PENDING
          : PROCESSING_STATUS.NONE,
      });

      io.emit("new-photo", {
        user: userSlug,
        imageId,
        filename: path.basename(destPath),
        fullPath: destPath,
      });

      scheduleBackgroundRemoval({
        userFolder,
        userSlug,
        imageId,
        todayFolder,
        packageType,
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
validateBackgroundRemovalAssets();

const wcThemeAssets = validateWorldCupThemeAssets();
if (wcThemeAssets.missing.length > 0) {
  console.warn(
    `[theme] Missing WC2026 assets (${wcThemeAssets.missing.join(", ")}). Run: npm run generate:wc2026-assets — API/cache/gradient fallback until assets exist.`
  );
} else {
  console.log(`[theme] WC2026 assets OK (${wcThemeAssets.dir})`);
}

const classicThemeAssets = validateClassicThemeAssets();
if (classicThemeAssets.missing.length > 0) {
  console.warn(
    `[theme] Missing classic assets (${classicThemeAssets.missing.join(", ")}). Run: npm run generate:classic-assets — API/cache/gradient fallback until assets exist.`
  );
} else {
  console.log(`[theme] Classic assets OK (${classicThemeAssets.dir})`);
}

server.listen(PORT, "0.0.0.0", () => {
  const todayFolder = getTodayFolder();

  console.log(`🚀 Server running http://localhost:${PORT}`);
  console.log(`📁 BASE_DIR: ${BASE_DIR}`);
  console.log(`🌐 Public host: ${PUBLIC_HOST}`);
  console.log(
    `🎭 BG removal: ${BG_REMOVAL_ENABLED ? "enabled" : "disabled"} (model=${getRemovalModel()})`
  );
  console.log(`🎨 Default theme: ${resolveDefaultThemeId()}`);
  console.log(
    `📊 Image queue: pending=${imageProcessingQueue.pendingCount} (rate limit ${getProcessRateLimitConfig().maxJobsPerUser}/user)`
  );
  console.log(`❤️  Health: GET /api/health · GET /api/health/image-processing`);
  console.log(`📦 Promo Tools: GET /api/promo-tools/products · GET /api/promo-tools/orders`);

  if (BG_REMOVAL_PREWARM) {
    void prewarmBackgroundRemoval();
  } else {
    console.log("[bg-removal] pre-warm skipped (set BG_REMOVAL_PREWARM=true to enable)");
  }

  if (process.platform === "win32" && BG_REMOVAL_ENABLED) {
    console.log("[bg-removal] Windows worker isolation enabled for remove-bg jobs");
  }

  // Defer job recovery so HTTP/Socket.IO accept connections first.
  setTimeout(() => {
    try {
      const recovered = recoverPendingJobs({
        baseDir: BASE_DIR,
        todayFolder,
        onJob: ({ userDir, imageId, user }) => {
          scheduleBackgroundRemoval({
            userFolder: userDir,
            userSlug: user,
            imageId,
            todayFolder,
            force: true,
          });
        },
      });

      if (recovered > 0) {
        console.log(`♻️ Recovered ${recovered} pending image job(s)`);
      }

      const passportRecovered = recoverIncompletePassportJobs({
        baseDir: BASE_DIR,
        todayFolder,
        onJob: ({ userDir, imageId, user }) => {
          schedulePassportBackground({
            userFolder: userDir,
            userSlug: user,
            imageId,
            todayFolder,
          });
        },
      });

      if (passportRecovered > 0) {
        console.log(`♻️ Recovered ${passportRecovered} incomplete passport job(s)`);
      }

      const themeRecovered = recoverIncompleteThemeJobs({
        baseDir: BASE_DIR,
        todayFolder,
        onJob: ({ userDir, imageId, user }) => {
          scheduleThemeGeneration({
            userFolder: userDir,
            userSlug: user,
            imageId,
            todayFolder,
          });
        },
      });

      if (themeRecovered > 0) {
        console.log(`♻️ Recovered ${themeRecovered} incomplete theme job(s)`);
      }
    } catch (err) {
      console.error(
        "[startup] image job recovery failed (server stays up):",
        err instanceof Error ? err.message : err
      );
    }
  }, 1500);
});
