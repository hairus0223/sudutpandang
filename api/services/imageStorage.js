import fs from "fs";
import path from "path";

/** @typedef {'none' | 'pending' | 'processing' | 'ready' | 'failed'} ProcessingStatus */

export const PROCESSING_STATUS = {
  NONE: "none",
  PENDING: "pending",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};

/**
 * @param {string} baseDir
 * @param {string} todayFolder
 * @param {string} userSlug
 */
export function getUserDir(baseDir, todayFolder, userSlug) {
  return path.join(baseDir, todayFolder, userSlug);
}

/** @param {string} userDir */
export function getCapturesDir(userDir) {
  return path.join(userDir, "captures");
}

/**
 * @param {string} userDir
 * @param {string} imageId
 */
export function getProcessedDir(userDir, imageId) {
  return path.join(userDir, "processed", imageId);
}

/**
 * @param {string} userDir
 * @param {string} imageId
 */
export function getMetaPath(userDir, imageId) {
  return path.join(getProcessedDir(userDir, imageId), "meta.json");
}

/**
 * @param {string} userDir
 * @param {string} imageId
 */
export function getSubjectPath(userDir, imageId) {
  return path.join(getProcessedDir(userDir, imageId), "subject.png");
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {string} ext
 */
export function getCapturePath(userDir, imageId, ext = ".jpg") {
  const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return path.join(getCapturesDir(userDir), `${imageId}${normalizedExt}`);
}

/**
 * @param {string} originalBasename
 */
export function generateImageId(originalBasename) {
  return path.basename(originalBasename, path.extname(originalBasename));
}

/**
 * @param {string} dir
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @returns {Record<string, unknown> | null}
 */
export function readMeta(userDir, imageId) {
  const metaPath = getMetaPath(userDir, imageId);
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {Record<string, unknown>} meta
 */
export function writeMeta(userDir, imageId, meta) {
  const processedDir = getProcessedDir(userDir, imageId);
  ensureDir(processedDir);
  fs.writeFileSync(getMetaPath(userDir, imageId), JSON.stringify(meta, null, 2));
}

/**
 * @param {object} params
 * @param {string} params.userDir
 * @param {string} params.imageId
 * @param {string} params.sourceFilename
 * @param {string} [params.ext]
 */
export function createPendingMeta({ userDir, imageId, sourceFilename, ext }) {
  const fileExt = ext || path.extname(sourceFilename) || ".jpg";
  const relativeOriginal = path.join("captures", `${imageId}${fileExt}`);

  const meta = {
    imageId,
    sourceFilename,
    status: PROCESSING_STATUS.PENDING,
    operations: [],
    createdAt: new Date().toISOString(),
    processedAt: null,
    variants: {
      original: relativeOriginal.split(path.sep).join("/"),
      subject: null,
    },
    error: null,
  };

  writeMeta(userDir, imageId, meta);
  return meta;
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {ProcessingStatus} status
 * @param {Record<string, unknown>} [patch]
 */
export function updateStatus(userDir, imageId, status, patch = {}) {
  const existing = readMeta(userDir, imageId) || { imageId, variants: {} };
  const operations = Array.isArray(existing.operations) ? [...existing.operations] : [];

  if (status === PROCESSING_STATUS.READY && !operations.includes("remove-bg")) {
    operations.push("remove-bg");
  }

  const variants = {
    ...(typeof existing.variants === "object" && existing.variants ? existing.variants : {}),
    ...(typeof patch.variants === "object" && patch.variants ? patch.variants : {}),
  };

  if (status === PROCESSING_STATUS.READY) {
    variants.subject = path
      .join("processed", imageId, "subject.png")
      .split(path.sep)
      .join("/");
  }

  const updated = {
    ...existing,
    ...patch,
    imageId,
    status,
    operations,
    variants,
    processedAt:
      status === PROCESSING_STATUS.READY
        ? patch.processedAt || new Date().toISOString()
        : patch.processedAt ?? existing.processedAt ?? null,
    error: status === PROCESSING_STATUS.FAILED ? patch.error ?? existing.error : null,
  };

  writeMeta(userDir, imageId, updated);
  return updated;
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {string} errorMessage
 */
export function markFailed(userDir, imageId, errorMessage) {
  return updateStatus(userDir, imageId, PROCESSING_STATUS.FAILED, {
    error: errorMessage,
  });
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {Buffer} buffer
 */
export function writeSubjectPng(userDir, imageId, buffer) {
  const subjectPath = getSubjectPath(userDir, imageId);
  ensureDir(path.dirname(subjectPath));
  fs.writeFileSync(subjectPath, buffer);
  return subjectPath;
}

/**
 * @param {string} userDir
 * @param {string} imageId
 * @param {Record<string, unknown> | null} [meta]
 * @returns {string | null}
 */
export function findOriginalPath(userDir, imageId, meta = null) {
  const resolvedMeta = meta || readMeta(userDir, imageId);
  if (resolvedMeta?.variants?.original) {
    const relative = String(resolvedMeta.variants.original);
    const absolute = path.join(userDir, relative);
    if (fs.existsSync(absolute)) return absolute;
  }

  const capturesDir = getCapturesDir(userDir);
  for (const fileExt of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = path.join(capturesDir, `${imageId}${fileExt}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Move a capture file from the watch folder into captures/ (rename, not copy).
 * @param {string} userDir
 * @param {string} incomingPath
 */
export function saveOriginalFromCapture(userDir, incomingPath) {
  const sourceFilename = `${Date.now()}-${path.basename(incomingPath)}`;
  const imageId = generateImageId(sourceFilename);
  const ext = path.extname(incomingPath) || ".jpg";
  const destPath = getCapturePath(userDir, imageId, ext);

  ensureDir(getCapturesDir(userDir));
  fs.renameSync(incomingPath, destPath);

  return { imageId, destPath, sourceFilename, ext };
}

/**
 * @param {string} userDir
 * @param {string} sourcePath
 * @param {string} [imageId]
 */
export function saveOriginalToCaptures(userDir, sourcePath, imageId) {
  const resolvedImageId = imageId || generateImageId(path.basename(sourcePath));
  const ext = path.extname(sourcePath) || ".jpg";
  const destPath = getCapturePath(userDir, resolvedImageId, ext);

  ensureDir(getCapturesDir(userDir));
  fs.copyFileSync(sourcePath, destPath);

  return { imageId: resolvedImageId, destPath };
}

/**
 * @param {string} userDir
 * @param {Buffer} buffer
 * @param {string} originalName
 */
export function saveUploadedToCaptures(userDir, buffer, originalName) {
  const sourceFilename = `${Date.now()}-${path.basename(originalName)}`;
  const imageId = generateImageId(sourceFilename);
  const ext = path.extname(originalName) || ".jpg";
  const destPath = getCapturePath(userDir, imageId, ext);

  ensureDir(getCapturesDir(userDir));
  fs.writeFileSync(destPath, buffer);

  return { imageId, destPath, sourceFilename, ext };
}

/**
 * Prepare a legacy root-level photo for the remove-bg pipeline.
 * Moves the file into captures/ and creates pending meta when needed.
 * @param {string} userDir
 * @param {string} imageId
 * @returns {{ imageId: string, destPath: string } | null}
 */
export function ingestLegacyPhoto(userDir, imageId) {
  const existingMeta = readMeta(userDir, imageId);
  if (existingMeta) {
    const destPath = findOriginalPath(userDir, imageId);
    return destPath ? { imageId, destPath } : null;
  }

  const originalInCaptures = findOriginalPath(userDir, imageId);
  if (
    originalInCaptures &&
    originalInCaptures.includes(`${path.sep}captures${path.sep}`)
  ) {
    const ext = path.extname(originalInCaptures) || ".jpg";
    createPendingMeta({
      userDir,
      imageId,
      sourceFilename: path.basename(originalInCaptures),
      ext,
    });
    return { imageId, destPath: originalInCaptures };
  }

  if (!fs.existsSync(userDir)) return null;

  for (const file of fs.readdirSync(userDir)) {
    const fullPath = path.join(userDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;
    if (generateImageId(file) !== imageId) continue;

    const ext = path.extname(file) || ".jpg";
    const destPath = getCapturePath(userDir, imageId, ext);

    ensureDir(getCapturesDir(userDir));
    fs.renameSync(fullPath, destPath);
    createPendingMeta({
      userDir,
      imageId,
      sourceFilename: file,
      ext,
    });

    return { imageId, destPath };
  }

  return null;
}

/**
 * @param {string} baseDir
 * @param {string} todayFolder
 * @returns {Array<{ userDir: string, imageId: string, user: string, status: string }>}
 */
export function findRecoverableJobs(baseDir, todayFolder) {
  const dayPath = path.join(baseDir, todayFolder);
  if (!fs.existsSync(dayPath)) return [];

  const jobs = [];

  for (const userSlug of fs.readdirSync(dayPath)) {
    const userDir = path.join(dayPath, userSlug);
    if (!fs.statSync(userDir).isDirectory()) continue;

    const processedRoot = path.join(userDir, "processed");
    if (!fs.existsSync(processedRoot)) continue;

    for (const imageId of fs.readdirSync(processedRoot)) {
      const meta = readMeta(userDir, imageId);
      if (
        !meta ||
        (meta.status !== PROCESSING_STATUS.PENDING &&
          meta.status !== PROCESSING_STATUS.PROCESSING)
      ) {
        continue;
      }

      jobs.push({
        userDir,
        imageId,
        user: userSlug,
        status: String(meta.status),
      });
    }
  }

  return jobs;
}
