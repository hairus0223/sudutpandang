import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import {
  bootstrapPromoToolsDirs,
  resolvePromoToolsDbPath,
  resolvePromoToolsUploadDir,
} from "./paths.js";

export const PROMO_TOOLS_API_VERSION = "0.3.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "../../migrations/promo-tools");

/** @type {DatabaseSync | null} */
let db = null;

/** @type {{ dbPath: string, uploadDir: string, baseDir: string } | null} */
let resolvedPaths = null;

/** @type {number} */
let schemaVersion = 0;

/** @type {string | null} */
let initError = null;

/**
 * @param {string} baseDir
 */
export function initPromoToolsDb(baseDir) {
  if (db) return db;

  const dbPath = resolvePromoToolsDbPath(baseDir);
  const uploadDir = resolvePromoToolsUploadDir(baseDir);
  resolvedPaths = { dbPath, uploadDir, baseDir };

  try {
    bootstrapPromoToolsDirs({ dbPath, uploadDir });
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    runMigrations();
    schemaVersion = readSchemaVersion();
    initError = null;
    console.log(`[promo-tools] DB ready (${dbPath}) · schema v${schemaVersion}`);
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
    console.error("[promo-tools] DB init failed:", initError);
  }

  return db;
}

function runMigrations() {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS promo_tools_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db
      .prepare("SELECT name FROM promo_tools_migrations")
      .all()
      .map((row) => row.name)
  );

  for (const fileName of files) {
    if (applied.has(fileName)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare(
        "INSERT INTO promo_tools_migrations (name, applied_at) VALUES (?, ?)"
      ).run(fileName, Date.now());
      db.exec("COMMIT");
      console.log(`[promo-tools] Applied migration ${fileName}`);
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

function readSchemaVersion() {
  if (!db) return 0;
  try {
    const row = db
      .prepare(
        "SELECT value FROM promo_tools_schema_meta WHERE key = 'schema_version'"
      )
      .get();
    return row ? Number(row.value) || 0 : 0;
  } catch {
    return 0;
  }
}

export function getPromoToolsDb() {
  return db;
}

export function getPromoToolsPaths() {
  return resolvedPaths;
}

/**
 * @returns {{
 *   ok: boolean,
 *   service: string,
 *   apiVersion: string,
 *   schemaVersion: number,
 *   serverTime: number,
 *   db: { ok: boolean, path: string | null, error?: string | null },
 *   uploads: { ok: boolean, path: string | null },
 *   uptimeSec: number
 * }}
 */
export function getPromoToolsHealth() {
  const paths = resolvedPaths;
  const now = Date.now();

  if (initError) {
    return {
      ok: false,
      service: "promo-tools",
      apiVersion: PROMO_TOOLS_API_VERSION,
      schemaVersion,
      serverTime: now,
      db: {
        ok: false,
        path: paths?.dbPath ?? null,
        error: initError,
      },
      uploads: {
        ok: false,
        path: paths?.uploadDir ?? null,
      },
      uptimeSec: Math.floor(process.uptime()),
    };
  }

  let dbOk = false;
  /** @type {string | null} */
  let dbError = null;

  if (db) {
    try {
      db.prepare("SELECT 1 AS ok").get();
      dbOk = true;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  } else {
    dbError = "database_not_initialized";
  }

  let uploadsOk = false;
  if (paths?.uploadDir) {
    try {
      uploadsOk = fs.existsSync(paths.uploadDir);
    } catch {
      uploadsOk = false;
    }
  }

  const ok = dbOk && uploadsOk;

  return {
    ok,
    service: "promo-tools",
    apiVersion: PROMO_TOOLS_API_VERSION,
    schemaVersion,
    serverTime: now,
    db: {
      ok: dbOk,
      path: paths?.dbPath ?? null,
      error: dbError,
    },
    uploads: {
      ok: uploadsOk,
      path: paths?.uploadDir ?? null,
    },
    uptimeSec: Math.floor(process.uptime()),
  };
}

/**
 * @returns {{
 *   service: string,
 *   apiVersion: string,
 *   schemaVersion: number,
 *   serverTime: number,
 *   serverTimeIso: string,
 *   paths: { db: string | null, uploads: string | null },
 *   features: Record<string, boolean>,
 *   phase: number
 * }}
 */
export function getPromoToolsMeta() {
  const health = getPromoToolsHealth();
  const now = Date.now();

  return {
    service: "promo-tools",
    apiVersion: PROMO_TOOLS_API_VERSION,
    schemaVersion: health.schemaVersion,
    serverTime: now,
    serverTimeIso: new Date(now).toISOString(),
    paths: {
      db: health.db.path,
      uploads: health.uploads.path,
    },
    features: {
      products: true,
      orders: true,
      transactions: false,
      backup: false,
      realtime: false,
    },
    phase: 3,
  };
}
