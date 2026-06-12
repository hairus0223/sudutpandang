import fs from "fs";
import path from "path";
import url from "url";
import os from "os";
import { spawn } from "child_process";
import {
  BG_REMOVAL_TIMEOUT_MS,
  getBundledRemovalModels,
  getDistDir,
  getRemovalModel,
  inferBackgroundRemovalFromFile,
  removeBackgroundFromBuffer,
  withRemovalTimeout,
} from "./backgroundRemovalInference.js";
import {
  alignSubjectDimensions,
  finalizeSubjectPng,
  prepareOrientedInput,
  refineSubjectAlpha,
} from "./imageOrientation.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BG_WORKER_SCRIPT = path.join(__dirname, "..", "scripts", "remove-bg-worker.js");

export {
  getBundledRemovalModels,
  getDistDir,
  getRemovalModel,
  withRemovalTimeout,
} from "./backgroundRemovalInference.js";

export const BG_REMOVAL_ENABLED = process.env.BG_REMOVAL_ENABLED !== "false";

/** Default off on Windows — ONNX prewarm can segfault the Node process under PM2. */
export const BG_REMOVAL_PREWARM =
  process.env.BG_REMOVAL_PREWARM === "true" ||
  (process.env.BG_REMOVAL_PREWARM !== "false" &&
    process.platform !== "win32");

/** Deep inference probe (loads ONNX). Off by default; enable for manual diagnostics only. */
export const BG_REMOVAL_HEALTH_PROBE =
  process.env.BG_REMOVAL_HEALTH_PROBE === "true";

/** 1×1 transparent PNG for pre-warm / health checks */
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export const BG_REMOVAL_USER_ERROR =
  "Proses hapus background gagal. Silakan coba lagi atau hubungi staf.";

/**
 * @returns {{ assetsPath: string, assetsFound: boolean, model: string, bundledModels: string[], requestedModel: string }}
 */
export function getBackgroundRemovalAssetsStatus() {
  const assetsPath = getDistDir();
  const bundledModels = getBundledRemovalModels();
  const model = getRemovalModel();

  return {
    assetsPath,
    assetsFound: fs.existsSync(assetsPath),
    model,
    bundledModels,
    requestedModel: (process.env.BG_REMOVAL_MODEL || "medium").trim().toLowerCase(),
  };
}

/**
 * Log a startup warning when WASM/ONNX assets are missing.
 */
export function validateBackgroundRemovalAssets() {
  if (!BG_REMOVAL_ENABLED) return;

  const status = getBackgroundRemovalAssetsStatus();
  if (!status.assetsFound) {
    console.warn(
      `[bg-removal] WASM assets not found at ${status.assetsPath}. Background removal will fail until @imgly/background-removal-node is installed correctly.`
    );
    return;
  }

  console.log(
    `[bg-removal] assets OK model=${status.model} bundled=[${status.bundledModels.join(",")}] timeoutMs=${BG_REMOVAL_TIMEOUT_MS}`
  );
}

/**
 * Align dimensions, recover trimmed subject edges, normalize PNG metadata.
 * @param {Buffer} buffer
 * @param {number} targetWidth
 * @param {number} targetHeight
 */
async function postProcessSubject(buffer, targetWidth, targetHeight) {
  let result = await alignSubjectDimensions(buffer, targetWidth, targetHeight);
  result = await refineSubjectAlpha(result);
  return finalizeSubjectPng(result);
}

/**
 * Map technical errors to operator-facing Indonesian messages.
 * @param {unknown} error
 * @returns {string}
 */
export function mapRemovalErrorToUserMessage(error) {
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown");

  if (message.includes("BG_REMOVAL_TIMEOUT")) {
    return "Proses hapus background terlalu lama. Silakan coba lagi.";
  }

  const lower = message.toLowerCase();

  if (
    lower.includes("glib-gobject-critical") ||
    lower.includes("3221225477") ||
    lower.includes("access violation")
  ) {
    return "Proses hapus background crash di mesin studio. Coba lagi atau hubungi staf.";
  }

  if (
    lower.includes("assets") ||
    lower.includes("wasm") ||
    lower.includes("onnx") ||
    lower.includes("publicpath") ||
    lower.includes("resource /models/")
  ) {
    return "Layanan hapus background belum siap. Hubungi staf.";
  }

  if (
    lower.includes("memory") ||
    lower.includes("enomem") ||
    lower.includes("allocation")
  ) {
    return "Memori tidak cukup untuk hapus background. Coba foto lebih kecil atau hubungi staf.";
  }

  if (lower.includes("enoent") || lower.includes("not found")) {
    return "File foto tidak ditemukan. Silakan ambil ulang foto.";
  }

  return BG_REMOVAL_USER_ERROR;
}

/**
 * Remove background in-process (non-Windows).
 * @param {string} inputPath
 * @returns {Promise<Buffer>}
 */
export async function removeImageBackgroundDirect(inputPath) {
  const prepared = await prepareOrientedInput(inputPath);

  const result = await withRemovalTimeout(
    removeBackgroundFromBuffer(prepared.buffer, "image/png"),
    BG_REMOVAL_TIMEOUT_MS,
    "remove-bg"
  );

  return postProcessSubject(
    result,
    prepared.targetWidth,
    prepared.targetHeight
  );
}

/**
 * Windows: Sharp in API process, ONNX in child worker (Sharp + ONNX crash together).
 * @param {string} inputPath
 * @returns {Promise<Buffer>}
 */
async function removeImageBackgroundViaWorker(inputPath) {
  const tmpIn = path.join(
    os.tmpdir(),
    `sp-bg-in-${process.pid}-${Date.now()}.png`
  );
  const tmpOut = path.join(
    os.tmpdir(),
    `sp-bg-out-${process.pid}-${Date.now()}.png`
  );

  try {
    const prepared = await prepareOrientedInput(inputPath);
    await fs.promises.mkdir(path.dirname(tmpIn), { recursive: true });
    await fs.promises.writeFile(tmpIn, prepared.buffer);

    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [BG_WORKER_SCRIPT, tmpIn, tmpOut],
        {
          cwd: path.join(__dirname, ".."),
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", reject);

      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              stderr.trim() ||
                `Background removal worker exited with code ${code ?? "unknown"}`
            )
          );
          return;
        }
        resolve(undefined);
      });
    });

    const raw = await fs.promises.readFile(tmpOut);
    return postProcessSubject(
      raw,
      prepared.targetWidth,
      prepared.targetHeight
    );
  } finally {
    await fs.promises.unlink(tmpIn).catch(() => {});
    await fs.promises.unlink(tmpOut).catch(() => {});
  }
}

/**
 * Remove background from an image file and return a transparent PNG buffer.
 * @param {string} inputPath
 * @returns {Promise<Buffer>}
 */
export async function removeImageBackground(inputPath) {
  if (process.platform === "win32") {
    return removeImageBackgroundViaWorker(inputPath);
  }

  return removeImageBackgroundDirect(inputPath);
}

/**
 * Remove background from an in-memory image buffer.
 * @param {Buffer} buffer
 * @param {string} [mimeType]
 * @returns {Promise<Buffer>}
 */
export async function removeImageBackgroundFromBuffer(
  buffer,
  mimeType = "image/jpeg"
) {
  if (process.platform === "win32") {
    const tmpIn = path.join(os.tmpdir(), `sp-bg-probe-in-${Date.now()}.png`);
    const tmpOut = path.join(os.tmpdir(), `sp-bg-probe-out-${Date.now()}.png`);

    try {
      await fs.promises.writeFile(tmpIn, buffer);
      await inferBackgroundRemovalFromFile(tmpIn).then((result) =>
        fs.promises.writeFile(tmpOut, result)
      );
      return fs.promises.readFile(tmpOut);
    } finally {
      await fs.promises.unlink(tmpIn).catch(() => {});
      await fs.promises.unlink(tmpOut).catch(() => {});
    }
  }

  return withRemovalTimeout(
    removeBackgroundFromBuffer(buffer, mimeType),
    BG_REMOVAL_TIMEOUT_MS,
    "remove-bg"
  );
}

/**
 * Load the removal model once at startup (optional).
 * @returns {Promise<{ success: boolean, durationMs: number, error?: string }>}
 */
export async function prewarmBackgroundRemoval() {
  if (!BG_REMOVAL_ENABLED || !BG_REMOVAL_PREWARM) {
    return { success: false, durationMs: 0, error: "prewarm_skipped" };
  }

  const status = getBackgroundRemovalAssetsStatus();
  if (!status.assetsFound) {
    return { success: false, durationMs: 0, error: "assets_missing" };
  }

  const startedAt = Date.now();
  try {
    await removeImageBackgroundFromBuffer(TINY_PNG_BUFFER, "image/png");
    const durationMs = Date.now() - startedAt;
    console.log(`[bg-removal] pre-warm OK ${durationMs}ms`);
    return { success: true, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[bg-removal] pre-warm failed (${durationMs}ms):`, message);
    return { success: false, durationMs, error: message };
  }
}

/**
 * Lightweight status (no ONNX load). Safe for frequent health polling.
 */
export function getBackgroundRemovalStatus() {
  const assets = getBackgroundRemovalAssetsStatus();

  if (!BG_REMOVAL_ENABLED) {
    return {
      ok: true,
      enabled: false,
      model: assets.model,
      assetsFound: assets.assetsFound,
      assetsPath: assets.assetsPath,
      prewarmRecommended: false,
      probeMode: "skipped",
      probe: { success: false, error: "disabled" },
    };
  }

  if (!assets.assetsFound) {
    return {
      ok: false,
      enabled: true,
      model: assets.model,
      assetsFound: false,
      assetsPath: assets.assetsPath,
      prewarmRecommended: true,
      probeMode: "skipped",
      probe: { success: false, error: "assets_missing" },
    };
  }

  return {
    ok: true,
    enabled: true,
    model: assets.model,
    assetsFound: true,
    assetsPath: assets.assetsPath,
    prewarmRecommended: !BG_REMOVAL_PREWARM,
    probeMode: "skipped",
    probe: {
      success: false,
      error: "probe_skipped_use_BG_REMOVAL_HEALTH_PROBE=true",
    },
  };
}

/**
 * Health probe for monitoring / operator diagnostics.
 * @param {{ deep?: boolean }} [options]
 * @returns {Promise<ReturnType<typeof getBackgroundRemovalStatus>>}
 */
export async function checkBackgroundRemovalHealth(options = {}) {
  const deep = options.deep === true || BG_REMOVAL_HEALTH_PROBE;
  const status = getBackgroundRemovalStatus();

  if (!deep || !status.enabled || !status.assetsFound) {
    return status;
  }

  const startedAt = Date.now();
  try {
    await removeImageBackgroundFromBuffer(TINY_PNG_BUFFER, "image/png");
    return {
      ...status,
      ok: true,
      prewarmRecommended: false,
      probeMode: "deep",
      probe: { success: true, durationMs: Date.now() - startedAt },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...status,
      ok: false,
      prewarmRecommended: true,
      probeMode: "deep",
      probe: {
        success: false,
        durationMs: Date.now() - startedAt,
        error: message,
      },
    };
  }
}
