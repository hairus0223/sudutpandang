import fs from "fs";
import path from "path";
import url from "url";
import { removeBackground } from "@imgly/background-removal-node";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export const BG_REMOVAL_TIMEOUT_MS =
  Number(process.env.BG_REMOVAL_TIMEOUT_MS) || 120_000;

const ALLOWED_MODELS = new Set(["small", "medium", "large"]);
const MODEL_PREFERENCE = ["large", "medium", "small"];

/** @type {string[] | null} */
let bundledRemovalModels = null;

export function getDistDir() {
  return path.join(
    __dirname,
    "..",
    "node_modules",
    "@imgly/background-removal-node",
    "dist"
  );
}

export function getBundledRemovalModels() {
  if (bundledRemovalModels) {
    return bundledRemovalModels;
  }

  try {
    const resourcesPath = path.join(getDistDir(), "resources.json");
    const resources = JSON.parse(fs.readFileSync(resourcesPath, "utf8"));
    bundledRemovalModels = Object.keys(resources)
      .filter((key) => key.startsWith("/models/"))
      .map((key) => key.replace("/models/", ""))
      .filter((model) => ALLOWED_MODELS.has(model));
  } catch {
    bundledRemovalModels = ["medium"];
  }

  return bundledRemovalModels;
}

export function getRemovalModel() {
  const requested = (process.env.BG_REMOVAL_MODEL || "medium")
    .trim()
    .toLowerCase();
  const available = getBundledRemovalModels();

  if (ALLOWED_MODELS.has(requested) && available.includes(requested)) {
    return requested;
  }

  for (const model of MODEL_PREFERENCE) {
    if (available.includes(model)) {
      if (requested !== model && ALLOWED_MODELS.has(requested)) {
        console.warn(
          `[bg-removal] model "${requested}" tidak tersedia offline — memakai "${model}"`
        );
      }
      return model;
    }
  }

  return available[0] || "medium";
}

export function getRemovalConfig() {
  const distDir = getDistDir();

  return {
    publicPath: `${url.pathToFileURL(distDir).toString()}/`,
    model: getRemovalModel(),
    output: {
      format: "image/png",
      quality: 1,
      type: "foreground",
    },
  };
}

export function withRemovalTimeout(promise, timeoutMs, label = "remove-bg") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`BG_REMOVAL_TIMEOUT:${label}`));
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

export async function removeBackgroundFromBuffer(buffer, mimeType = "image/png") {
  const normalizedMime = normalizeImageMimeType(mimeType);
  const blob = new Blob([buffer], { type: normalizedMime });
  const resultBlob = await removeBackground(blob, getRemovalConfig());
  return Buffer.from(await resultBlob.arrayBuffer());
}

/**
 * ONNX inference only — no Sharp (safe for isolated Windows worker).
 * @param {string} preparedPngPath
 * @returns {Promise<Buffer>}
 */
export async function inferBackgroundRemovalFromFile(preparedPngPath) {
  const data = await fs.promises.readFile(preparedPngPath);

  return withRemovalTimeout(
    removeBackgroundFromBuffer(data, "image/png"),
    BG_REMOVAL_TIMEOUT_MS,
    "remove-bg"
  );
}
