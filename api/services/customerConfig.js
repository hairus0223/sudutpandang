import fs from "fs";
import path from "path";
import { normalizePassportSizeId } from "./passportSizes.js";
import { normalizeThemeId } from "./themePresets.js";
import {
  defaultLookForPackage,
  normalizeLookId,
} from "./lookPresets.js";

/** @type {Record<string, string>} */
export const PASSPORT_COLOR_PRESETS = {
  white: "#FFFFFF",
  blue: "#438CCB",
  red: "#CC0000",
};

export const DEFAULT_PASSPORT_COLOR = PASSPORT_COLOR_PRESETS.white;

/**
 * @param {string | undefined | null} input
 * @returns {string}
 */
export function normalizePassportColor(input) {
  if (!input) return DEFAULT_PASSPORT_COLOR;

  const raw = String(input).trim();
  const preset = PASSPORT_COLOR_PRESETS[raw.toLowerCase()];
  if (preset) return preset;

  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();

  return DEFAULT_PASSPORT_COLOR;
}

/**
 * @param {string} userFolder
 */
export function readCustomerJson(userFolder) {
  try {
    const file = path.join(userFolder, "customer.json");
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} userFolder
 */
export function readCustomerPackageType(userFolder) {
  const data = readCustomerJson(userFolder);
  return data?.packageType || "self-photo";
}

/**
 * @param {string} userFolder
 */
export function readPassportBackgroundColor(userFolder) {
  const data = readCustomerJson(userFolder);
  return normalizePassportColor(data?.passportBackgroundColor);
}

/**
 * @param {string} userFolder
 */
export function readCustomerThemeId(userFolder) {
  const data = readCustomerJson(userFolder);
  return normalizeThemeId(data?.themeId);
}

/**
 * @param {string} userFolder
 */
export function readPassportSizeId(userFolder) {
  const data = readCustomerJson(userFolder);
  return normalizePassportSizeId(data?.passportSizeId);
}

/**
 * @param {string} userFolder
 */
export function readCustomerLookId(userFolder) {
  const data = readCustomerJson(userFolder);
  const packageType = data?.packageType || "self-photo";
  return normalizeLookId(data?.lookId, packageType);
}

/**
 * Persist lookId on customer.json (creates minimal file if missing).
 * @param {string} userFolder
 * @param {string} lookId
 * @param {string} [packageType]
 * @returns {string} normalized lookId
 */
export function writeCustomerLookId(userFolder, lookId, packageType) {
  const existing = readCustomerJson(userFolder) || {};
  const pkg = packageType || existing.packageType || "self-photo";
  const resolved =
    pkg === "pas-photo"
      ? "natural"
      : normalizeLookId(lookId, pkg);

  const next = {
    ...existing,
    packageType: pkg,
    lookId: resolved,
  };

  fs.mkdirSync(userFolder, { recursive: true });
  fs.writeFileSync(
    path.join(userFolder, "customer.json"),
    JSON.stringify(next, null, 2)
  );

  return resolved;
}

export { defaultLookForPackage, normalizeLookId };
