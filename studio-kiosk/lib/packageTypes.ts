export type PackageType = "self-photo" | "ai-self-photo";

export const PACKAGE_TYPES: PackageType[] = ["self-photo", "ai-self-photo"];

export type PackageOption = {
  id: PackageType;
  label: string;
  description: string;
  badge?: string;
};

export const PACKAGE_OPTIONS: PackageOption[] = [
  {
    id: "self-photo",
    label: "Self Photo",
    description: "Sesi foto studio klasik · cetak dari galeri",
  },
  {
    id: "ai-self-photo",
    label: "AI Self Photo",
    description: "Shoot dulu · pilih foto · generate AI bertema",
    badge: "Kuota AI = jumlah orang",
  },
];

export function getPackageLabel(packageType: PackageType): string {
  return (
    PACKAGE_OPTIONS.find((option) => option.id === packageType)?.label ??
    packageType
  );
}

export function resolveAiGenerateLimit(
  packageType: PackageType,
  peopleCount: number
): number {
  if (packageType !== "ai-self-photo") return 0;
  return Math.max(1, Math.min(8, peopleCount || 1));
}
