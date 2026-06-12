export type ProcessingStatus =
  | "none"
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export type ProcessingPhase =
  | "remove-bg"
  | "apply-theme"
  | "apply-passport-bg";

export type ThemeBackgroundSource = "asset" | "cache" | "api" | "gradient";

export type PackageType = "self-photo" | "pas-photo" | "ai-photo";

export type ImageVariants = {
  original?: string;
  subject?: string;
  passport?: string;
  themed?: string;
};

export type GalleryImageData = {
  filename: string;
  url: string;
  imageId?: string;
  processingStatus?: ProcessingStatus;
  processingPhase?: ProcessingPhase | null;
  processingError?: string | null;
  themeBackgroundSource?: ThemeBackgroundSource | null;
  variants?: ImageVariants;
};

export type FetchImagesResponse = {
  images: GalleryImageData[];
};

export type ImageStatusResponse = {
  imageId: string;
  status: ProcessingStatus;
  processingPhase?: ProcessingPhase | null;
  variants: ImageVariants;
  error: string | null;
  themeBackgroundSource?: ThemeBackgroundSource | null;
};

export type ThemeCategory = string;

export type ThemeCategoryKind = "event" | "permanent";

export type ThemeCategoryMeta = {
  id: string;
  label: string;
  kind: ThemeCategoryKind;
  sortOrder: number;
  pickerCompact: boolean;
  themeCount: number;
  assetsReady: boolean;
  missingCount: number;
};

export type ThemeOption = {
  id: string;
  label: string;
  category: ThemeCategory;
  previewGradient: string;
  hasAsset: boolean;
  assetAvailable: boolean;
};

export type ThemeGroup = ThemeCategoryMeta & {
  themes: ThemeOption[];
};

export type FetchThemesResponse = {
  defaultThemeId: string;
  themes: ThemeOption[];
  categories?: ThemeCategoryMeta[];
};

export type ProcessImageResponse = {
  success: boolean;
  imageId: string;
  status: string;
};

export type UploadImageResponse = {
  success: boolean;
  imageId: string;
  originalUrl: string;
  status: string;
};

export type PollImageStatusOptions = {
  intervalMs?: number;
  maxMs?: number;
  signal?: AbortSignal;
};
