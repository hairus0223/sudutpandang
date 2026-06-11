import fs from "fs";
import os from "os";
import path from "path";

/**
 * Resolve studio base directory from env with sensible OS defaults.
 * @returns {string}
 */
export function resolveBaseDir() {
  if (process.env.BASE_DIR) {
    return process.env.BASE_DIR;
  }

  if (process.platform === "win32") {
    return "D:\\SudutPandangStudio";
  }

  return path.join(os.homedir(), "SudutPandangStudio");
}

/**
 * @param {string} baseDir
 */
export function bootstrapStudioDirs(baseDir) {
  const dirs = [
    baseDir,
    path.join(baseDir, "capture"),
    path.join(baseDir, "headline"),
    path.join(baseDir, "print"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
