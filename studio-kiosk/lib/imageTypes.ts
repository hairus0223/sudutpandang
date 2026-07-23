export type ProcessingStatus =
  | "none"
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "queued";

export type ProcessingPhase = null | string;

export type PackageType = "self-photo" | "ai-self-photo";

export type PrintVariant = "original" | "ai";

export type AiThemeType = "scene" | "transform";

export type AiTheme = {
  id: string;
  label: string;
  description: string;
  previewColor: string;
  type: AiThemeType;
  previewUrl: string | null;
  previewBeforeUrl?: string | null;
  previewSource?: "studio" | "bundled";
  seasonal?: boolean;
};

export type AiSelectionEntry = {
  imageId?: string;
  themeId?: string;
  jobId?: string;
  status?: ProcessingStatus;
  phase?: ProcessingPhase;
  error?: string | null;
  outputPath?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SessionThemeInfo = {
  aiThemeId: string | null;
  aiThemeLabel: string | null;
  aiThemeLocked: boolean;
};

export type ImageVariants = {
  original?: string;
  ai?: Record<string, string>;
};

export type GalleryImageData = {
  filename: string;
  url: string;
  imageId?: string;
  processingStatus?: ProcessingStatus;
  processingPhase?: ProcessingPhase;
  processingError?: string | null;
  variants?: ImageVariants;
  aiSelection?: AiSelectionEntry | null;
};

export type FetchImagesResponse = {
  images: GalleryImageData[];
};

export type AiThemesResponse = {
  themes: AiTheme[];
};

export type AiQuotaSnapshot = {
  limit: number;
  used: number;
  remaining: number;
  pending?: number;
  available?: number;
};

export type AiGenerateResponse = {
  jobId: string;
  status: ProcessingStatus;
  imageId: string;
  themeId: string;
  phase?: ProcessingPhase;
  aiUrl?: string | null;
  outputPath?: string | null;
  error?: string | null;
  quota?: AiQuotaSnapshot;
  aiThemeId?: string | null;
  aiThemeLabel?: string | null;
  aiThemeLocked?: boolean;
};
