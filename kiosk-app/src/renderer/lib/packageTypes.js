/** @typedef {"self-photo" | "theme-self-photo" | "ai-self-photo" | "pas-photo"} PackageType */

export const PACKAGE_LABELS = {
  "self-photo": "Self Photo",
  "theme-self-photo": "Foto Tema",
  "ai-self-photo": "AI Self Photo",
  "pas-photo": "Pas Photo",
};

/**
 * @param {string | undefined | null} packageType
 */
export function getPackageLabel(packageType) {
  if (packageType === "theme-self-photo") return PACKAGE_LABELS["theme-self-photo"];
  if (packageType === "ai-self-photo") return PACKAGE_LABELS["ai-self-photo"];
  if (packageType === "pas-photo") return PACKAGE_LABELS["pas-photo"];
  return PACKAGE_LABELS["self-photo"];
}
