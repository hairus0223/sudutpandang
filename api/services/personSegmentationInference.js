import fs from "fs";
import path from "path";
import url from "url";
import { removeBackground } from "@imgly/background-removal-node";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export const PERSON_SEGMENTATION_TIMEOUT_MS =
  Number(process.env.PERSON_SEGMENTATION_TIMEOUT_MS) || 120_000;

const ALLOWED_MODELS = new Set(["small", "medium", "large"]);
const MODEL_PREFERENCE = ["medium", "small", "large"];

/** @type {string[] | null} */
let bundledModels = null;

export function getSegmentationDistDir() {
  return path.join(
    __dirname,
    "..",
    "node_modules",
    "@imgly",
    "background-removal-node",
    "dist"
  );
}

export function getBundledSegmentationModels() {
  if (bundledModels) {
    return bundledModels;
  }

  try {
    const resourcesPath = path.join(getSegmentationDistDir(), "resources.json");
    const resources = JSON.parse(fs.readFileSync(resourcesPath, "utf8"));
    bundledModels = Object.keys(resources)
      .filter((key) => key.startsWith("/models/"))
      .map((key) => key.replace("/models/", ""))
      .filter((model) => ALLOWED_MODELS.has(model));
  } catch {
    bundledModels = ["medium"];
  }

  return bundledModels;
}

export function getSegmentationModel() {
  const requested = (process.env.PERSON_SEGMENTATION_MODEL || "medium")
    .trim()
    .toLowerCase();
  const available = getBundledSegmentationModels();

  if (ALLOWED_MODELS.has(requested) && available.includes(requested)) {
    return requested;
  }

  for (const model of MODEL_PREFERENCE) {
    if (available.includes(model)) {
      if (requested !== model && ALLOWED_MODELS.has(requested)) {
        console.warn(
          `[person-segmentation] model "${requested}" unavailable — using "${model}"`
        );
      }
      return model;
    }
  }

  return available[0] || "medium";
}

export function getSegmentationConfig() {
  const distDir = getSegmentationDistDir();

  return {
    publicPath: `${url.pathToFileURL(distDir).toString()}/`,
    model: getSegmentationModel(),
    output: {
      format: "image/png",
      quality: 1,
      type: "foreground",
    },
  };
}

/**
 * @param {Promise<unknown>} promise
 * @param {number} timeoutMs
 * @param {string} [label]
 */
export function withSegmentationTimeout(promise, timeoutMs, label = "segment") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`PERSON_SEGMENTATION_TIMEOUT:${label}`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * @param {string} extOrMime
 */
function normalizeImageMimeType(extOrMime) {
  const value = String(extOrMime || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");

  if (value === "jpg" || value === "jpeg" || value === "image/jpg") {
    return "image/jpeg";
  }
  if (value.startsWith("image/")) {
    return value === "image/jpg" ? "image/jpeg" : value;
  }
  if (value === "png") return "image/png";
  if (value === "webp") return "image/webp";
  return `image/${value || "jpeg"}`;
}

/**
 * @param {Buffer} buffer
 * @param {string} [mimeType]
 * @returns {Promise<Buffer>}
 */
export async function segmentPersonFromBuffer(buffer, mimeType = "image/png") {
  const normalizedMime = normalizeImageMimeType(mimeType);
  const blob = new Blob([buffer], { type: normalizedMime });
  const resultBlob = await removeBackground(blob, getSegmentationConfig());
  return Buffer.from(await resultBlob.arrayBuffer());
}

/**
 * @param {string} preparedPngPath
 * @returns {Promise<Buffer>}
 */
export async function inferPersonSegmentationFromFile(preparedPngPath) {
  const data = await fs.promises.readFile(preparedPngPath);

  return withSegmentationTimeout(
    segmentPersonFromBuffer(data, "image/png"),
    PERSON_SEGMENTATION_TIMEOUT_MS,
    "segment"
  );
}
