import fs from "fs";
import path from "path";
import { compositePassportPhoto } from "./passportComposite.js";
import { analyzeSubjectGeometry } from "./passportFraming.js";
import { rebuildPassportSubject } from "./passportMatte.js";
import { retouchPassportSubject } from "./passportRetouch.js";
import { PASSPORT_SIZE_PRESETS } from "./passportSizes.js";
import { segmentAndSaveArtifacts } from "./personSegmentation.js";
import { getPassportSegmentationModel } from "./personSegmentationInference.js";
import {
  readPassportBackgroundColor,
  readCustomerPackageType,
} from "./customerConfig.js";
import {
  PROCESSING_STATUS,
  findOriginalPath,
  findIncompletePassportJobs,
  getPassportPath,
  getPassportPrintPath,
  getPassportSizePath,
  getSubjectPath,
  markFailed,
  updateAfterPassportBg,
  updateAfterRemoveBg,
  updateStatus,
} from "./imageStorage.js";

/** @type {Promise<void>} */
let passportQueue = Promise.resolve();

function enqueue(task) {
  passportQueue = passportQueue.then(task, task);
  return passportQueue;
}

function relativeVariant(imageId, filename) {
  return path.join("processed", imageId, filename).split(path.sep).join("/");
}

/**
 * @param {{
 *   userDir: string,
 *   imageId: string,
 *   user: string,
 *   host: string,
 *   io: { emit: (event: string, payload: unknown) => void },
 *   buildPublicUrl: (relativePath: string) => string,
 * }} options
 */
export async function runPassportPipeline({
  userDir,
  imageId,
  user,
  io,
  buildPublicUrl,
}) {
  const originalPath = findOriginalPath(userDir, imageId);
  if (!originalPath) {
    throw new Error("original_missing");
  }

  updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, {
    processingPhase: "remove-bg",
    error: null,
  });

  await segmentAndSaveArtifacts({
    userDir,
    imageId,
    sourcePath: originalPath,
    portraitBoost: true,
    model: getPassportSegmentationModel(),
  });
  const subjectPath = getSubjectPath(userDir, imageId);
  updateAfterRemoveBg(userDir, imageId, "passport");

  updateStatus(userDir, imageId, PROCESSING_STATUS.PROCESSING, {
    processingPhase: "retouch",
    error: null,
  });

  try {
    const rebuilt = await rebuildPassportSubject({
      originalPath,
      subjectBuffer: fs.readFileSync(subjectPath),
    });
    fs.writeFileSync(subjectPath, await retouchPassportSubject(rebuilt));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[pas-photo] matte rebuild skipped: ${message}`);
  }

  const backgroundColor = readPassportBackgroundColor(userDir);
  const sizeResults = {};

  let geometry = null;
  try {
    geometry = await analyzeSubjectGeometry(fs.readFileSync(subjectPath));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[pas-photo] framing fallback to centre crop: ${message}`);
  }

  for (const size of PASSPORT_SIZE_PRESETS) {
    const outputPath = getPassportSizePath(userDir, imageId, size.id);
    sizeResults[size.id] = await compositePassportPhoto({
      subjectPath,
      outputPath,
      backgroundColor,
      sizeId: size.id,
      geometry,
      jpegPath: getPassportPrintPath(userDir, imageId, size.id),
    });
  }

  const alias3x4 = getPassportSizePath(userDir, imageId, "3x4");
  const passportAlias = getPassportPath(userDir, imageId);
  fs.copyFileSync(alias3x4, passportAlias);

  const updated = updateAfterPassportBg(
    userDir,
    imageId,
    backgroundColor,
    "3x4",
    sizeResults["3x4"],
    {
      "2x3": relativeVariant(imageId, "passport-2x3.png"),
      "3x4": relativeVariant(imageId, "passport-3x4.png"),
      "4x6": relativeVariant(imageId, "passport-4x6.png"),
    },
    {
      "2x3": relativeVariant(imageId, "passport-2x3-print.jpg"),
      "3x4": relativeVariant(imageId, "passport-3x4-print.jpg"),
      "4x6": relativeVariant(imageId, "passport-4x6-print.jpg"),
    }
  );

  io.emit("photo-processed", {
    user,
    imageId,
    status: PROCESSING_STATUS.READY,
    originalUrl: buildPublicUrl(String(updated.variants.original)),
    subjectUrl: buildPublicUrl(String(updated.variants.subject)),
    passportUrl: buildPublicUrl(String(updated.variants.passport)),
    passportSizes: {
      "2x3": buildPublicUrl(updated.variants.passportSizes["2x3"]),
      "3x4": buildPublicUrl(updated.variants.passportSizes["3x4"]),
      "4x6": buildPublicUrl(updated.variants.passportSizes["4x6"]),
    },
    passportPrintSizes: {
      "2x3": buildPublicUrl(updated.variants.passportPrintSizes["2x3"]),
      "3x4": buildPublicUrl(updated.variants.passportPrintSizes["3x4"]),
      "4x6": buildPublicUrl(updated.variants.passportPrintSizes["4x6"]),
    },
  });
}

/**
 * @param {object} options
 */
export function schedulePassportPipeline(options) {
  enqueue(async () => {
    try {
      await runPassportPipeline(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pas-photo] ${options.imageId} failed:`, message);
      markFailed(options.userDir, options.imageId, message);
      options.io.emit("photo-processed", {
        user: options.user,
        imageId: options.imageId,
        status: PROCESSING_STATUS.FAILED,
        error: "Gagal menyiapkan pas foto. Foto asli tetap tersimpan.",
      });
    }
  });
}

/**
 * Resume pas-photo jobs interrupted by a server restart.
 */
export function resumeIncompletePassportJobs({
  baseDir,
  todayFolder,
  io,
  buildPublicUrlForUser,
}) {
  const jobs = findIncompletePassportJobs(baseDir, todayFolder);
  if (!jobs.length) return;

  console.log(`[pas-photo] resuming ${jobs.length} incomplete job(s)`);
  for (const job of jobs) {
    if (readCustomerPackageType(job.userDir) !== "pas-photo") continue;
    schedulePassportPipeline({
      userDir: job.userDir,
      imageId: job.imageId,
      user: job.user,
      io,
      buildPublicUrl: (relativePath) =>
        buildPublicUrlForUser(job.user, relativePath),
    });
  }
}
