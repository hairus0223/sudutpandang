export type PackageType = "self-photo" | "theme-self-photo" | "ai-self-photo" | "pas-photo";

export const PACKAGE_TYPES: PackageType[] = [
  "self-photo",
  "theme-self-photo",
  "ai-self-photo",
  "pas-photo",
];

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
    id: "theme-self-photo",
    label: "Foto Tema",
    description: "Orang identik · latar tema · tanpa AI",
    badge: "Otomatis setelah foto · siap cetak",
  },
  {
    id: "ai-self-photo",
    label: "AI Self Photo",
    description: "Ambil foto dulu · edit latar & kostum di galeri",
    badge: "Kuota edit = jumlah orang",
  },
  {
    id: "pas-photo",
    label: "Pas Photo",
    description: "Latar merah/biru/custom · soft file 2×3, 3×4, 4×6",
    badge: "1 orang · 8 menit",
  },
];

export function getPackageLabel(packageType: PackageType): string {
  return (
    PACKAGE_OPTIONS.find((option) => option.id === packageType)?.label ??
    packageType
  );
}

export function isThemePhotoPackage(packageType: PackageType): boolean {
  return packageType === "theme-self-photo";
}

export function usesSessionTheme(packageType: PackageType): boolean {
  return packageType === "ai-self-photo" || packageType === "theme-self-photo";
}

export function resolveAiGenerateLimit(
  packageType: PackageType,
  peopleCount: number
): number {
  if (packageType !== "ai-self-photo") return 0;
  return Math.max(1, Math.min(8, peopleCount || 1));
}
