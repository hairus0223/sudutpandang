import fs from "fs";
import path from "path";

/**
 * Resolve SQLite database path for Promotion Tools.
 * @param {string} baseDir - Studio base directory (BASE_DIR)
 * @returns {string}
 */
export function resolvePromoToolsDbPath(baseDir) {
  if (process.env.PROMO_TOOLS_DB_PATH) {
    return process.env.PROMO_TOOLS_DB_PATH;
  }
  return path.join(baseDir, "data", "promo-tools.db");
}

/**
 * Resolve upload directory for Promotion Tools assets.
 * @param {string} baseDir
 * @returns {string}
 */
export function resolvePromoToolsUploadDir(baseDir) {
  if (process.env.PROMO_TOOLS_UPLOAD_DIR) {
    return process.env.PROMO_TOOLS_UPLOAD_DIR;
  }
  return path.join(baseDir, "uploads", "promo-tools");
}

/**
 * Ensure data + upload directories exist.
 * @param {{ dbPath: string, uploadDir: string }} paths
 */
export function bootstrapPromoToolsDirs({ dbPath, uploadDir }) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(path.join(uploadDir, "products"), { recursive: true });
  fs.mkdirSync(path.join(uploadDir, "studio-images"), { recursive: true });
}
