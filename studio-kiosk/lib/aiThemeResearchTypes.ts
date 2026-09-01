export type ResearchSample = {
  id: string;
  originalName: string;
  url: string;
  createdAt: string;
};

export type CostumePreset = {
  id: string;
  label: string;
  description: string;
  previewColor: string;
};

export type AiPipelineMode = "direct" | "composite-only" | "composite-costume";

export type DraftInput = {
  workingTitle: string;
  transformPrompt: string;
  negativePrompt: string;
  notes: string;
  themeId?: string;
  label?: string;
  description?: string;
  previewColor?: string;
  pipelineMode?: AiPipelineMode;
  costumePresetId?: string;
  customWardrobe?: string;
  promptMode?: "studio" | "advanced";
};

export type ResearchDraft = DraftInput & {
  id: string;
  backgroundReady?: boolean;
  backgroundUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchQualityPreset = {
  id: string;
  label: string;
  description: string;
  quality: string;
  inputFidelity: string;
  recommended?: boolean;
  costUsd?: number;
};

export type ResearchRun = {
  id: string;
  draftId: string | null;
  sampleId: string;
  transformPrompt: string;
  negativePrompt: string;
  durationMs: number;
  status: "ready" | "failed";
  error: string | null;
  errorCode?: string;
  editMode?: "full" | "masked" | "composite" | "composite-costume";
  faceRefined?: boolean;
  qualityPreset?: string;
  quality?: string;
  inputFidelity?: string;
  costUsd?: number;
  createdAt: string;
  resultUrl?: string;
};

export type ResearchMeta = {
  ok: boolean;
  service: string;
  sampleCount: number;
  draftCount: number;
  runCount: number;
  maxPromptLength: number;
  maxImageBytes: number;
  openaiTier?: {
    research: { quality: string; inputFidelity: string };
    production: { quality: string; inputFidelity: string };
  };
  pricing?: {
    researchPreviewUsd: number;
    productionGenerateUsd: number;
    formatted: {
      researchPreview: string;
      productionGenerate: string;
    };
  };
  pipeline?: {
    name: string;
    compositeBoothAvailable?: boolean;
    costumePassAvailable?: boolean;
  };
  costumePresets?: CostumePreset[];
  studio?: {
    version: number;
    defaultPipelineMode: AiPipelineMode;
  };
  usageSummary?: {
    days: number;
    researchCalls: number;
    researchCostUsd: number;
  };
  qualityPresets?: ResearchQualityPreset[];
};

export type ResearchUsageSummary = {
  days: number;
  source: string | null;
  totalCalls: number;
  totalCostUsd: number;
  galleryCostUsd: number;
  researchCostUsd: number;
  bySource: Record<string, { calls: number; costUsd: number }>;
  byDay: Record<string, { calls: number; costUsd: number }>;
  byTier: Record<string, { calls: number; costUsd: number }>;
};

export type PublishInput = {
  draftId: string;
  id: string;
  label: string;
  description: string;
  previewColor: string;
};

export class AiThemeResearchError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}
