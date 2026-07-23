/** @typedef {"self-photo" | "ai-self-photo"} PackageType */

export const PACKAGE_LABELS = {
  "self-photo": "Self Photo",
  "ai-self-photo": "AI Self Photo",
};

/**
 * @param {string | undefined | null} packageType
 */
export function getPackageLabel(packageType) {
  if (packageType === "ai-self-photo") return PACKAGE_LABELS["ai-self-photo"];
  return PACKAGE_LABELS["self-photo"];
}
