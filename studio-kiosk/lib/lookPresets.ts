import type { PhotoFilter } from "@/stores/useGalleryStore";

export const LOOK_IDS = ["natural", "soft", "warm", "cinematic"] as const;

export type LookId = (typeof LOOK_IDS)[number];

export const LOOK_PRESETS: { id: LookId; label: string }[] = [
  { id: "natural", label: "Natural" },
  { id: "soft", label: "Soft" },
  { id: "warm", label: "Warm" },
  { id: "cinematic", label: "Cinematic" },
];

/** Soft default for print seeding — not full intensity. */
export const LOOK_PRINT_INTENSITY = 0.6;

export function defaultLookForPackage(packageType?: string | null): LookId {
  if (packageType === "pas-photo") return "natural";
  if (packageType === "ai-photo") return "natural";
  return "soft";
}

export function normalizeLookId(
  input?: string | null,
  packageType?: string | null
): LookId {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  if ((LOOK_IDS as readonly string[]).includes(raw)) {
    return raw as LookId;
  }
  return defaultLookForPackage(packageType);
}

export function lookIdToPhotoFilter(lookId?: string | null): PhotoFilter {
  const id = normalizeLookId(lookId);
  return id === "natural" ? "none" : (id as PhotoFilter);
}

export function lookAllowsPicker(packageType?: string | null): boolean {
  return packageType !== "pas-photo";
}
