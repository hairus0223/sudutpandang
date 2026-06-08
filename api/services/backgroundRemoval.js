import fs from "fs";
import path from "path";
import url from "url";
import { removeBackground } from "@imgly/background-removal-node";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * Resolve local WASM/ONNX assets for offline LAN studio use.
 * @returns {import('@imgly/background-removal-node').Config}
 */
function getRemovalConfig() {
  const distDir = path.join(
    __dirname,
    "..",
    "node_modules",
    "@imgly/background-removal-node",
    "dist"
  );

  return {
    publicPath: `${url.pathToFileURL(distDir).toString()}/`,
    model: "medium",
    output: {
      format: "image/png",
      quality: 1,
    },
  };
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
async function removeBackgroundFromBuffer(buffer, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  const resultBlob = await removeBackground(blob, getRemovalConfig());
  return Buffer.from(await resultBlob.arrayBuffer());
}

/**
 * Remove background from an image file and return a transparent PNG buffer.
 * @param {string} inputPath
 * @returns {Promise<Buffer>}
 */
export async function removeImageBackground(inputPath) {
  const data = await fs.promises.readFile(inputPath);
  const ext = path.extname(inputPath).replace(".", "") || "jpeg";
  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return removeBackgroundFromBuffer(data, mimeType);
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
  return removeBackgroundFromBuffer(buffer, mimeType);
}
