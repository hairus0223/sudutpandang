import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEMES_README_TEMPLATE = path.join(
  __dirname,
  "..",
  "assets",
  "themes-README.template.md"
);

/**
 * @param {string} baseDir
 */
function ensureThemesReadme(baseDir) {
  const dest = path.join(baseDir, "themes", "README.md");
  if (fs.existsSync(dest)) return;
  if (!fs.existsSync(THEMES_README_TEMPLATE)) return;

  fs.copyFileSync(THEMES_README_TEMPLATE, dest);
}

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
    path.join(baseDir, "data"),
    path.join(baseDir, "config"),
    path.join(baseDir, "themes"),
    path.join(baseDir, "research"),
    path.join(baseDir, "research", "samples"),
    path.join(baseDir, "research", "results"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  ensureThemesReadme(baseDir);
}
