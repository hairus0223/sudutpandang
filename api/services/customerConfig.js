import fs from "fs";
import path from "path";
import { normalizePackageType } from "./packageTypes.js";

/** @type {Record<string, string>} */
export const PASSPORT_COLOR_PRESETS = {
  red: "#CC0000",
  blue: "#438CCB",
};

export const DEFAULT_PASSPORT_COLOR = PASSPORT_COLOR_PRESETS.blue;

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
 * @param {string | undefined | null} id
 * @param {string | undefined | null} color
 */
export function resolvePassportBackground(id, color) {
  const rawId = String(id || "").trim().toLowerCase();
  if (rawId === "red" || rawId === "blue") {
    return {
      passportBackgroundId: rawId,
      passportBackgroundColor: PASSPORT_COLOR_PRESETS[rawId],
    };
  }

  return {
    passportBackgroundId: "custom",
    passportBackgroundColor: normalizePassportColor(color),
  };
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
  return normalizePackageType(data?.packageType);
}

/**
 * @param {string} userFolder
 */
export function readPassportBackgroundColor(userFolder) {
  const data = readCustomerJson(userFolder);
  return normalizePassportColor(data?.passportBackgroundColor);
}
