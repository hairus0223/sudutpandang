/** @typedef {"self-photo" | "ai-self-photo"} PackageType */

export const PACKAGE_TYPES = /** @type {const} */ ([
  "self-photo",
  "ai-self-photo",
]);

const SESSION_DURATION_MINUTES =
  process.env.SESSION_DURATION_MINUTES &&
  !Number.isNaN(Number(process.env.SESSION_DURATION_MINUTES))
    ? Number(process.env.SESSION_DURATION_MINUTES)
    : 10;

const AI_SELF_PHOTO_DURATION_MINUTES =
  process.env.AI_SELF_PHOTO_DURATION_MINUTES &&
  !Number.isNaN(Number(process.env.AI_SELF_PHOTO_DURATION_MINUTES))
    ? Number(process.env.AI_SELF_PHOTO_DURATION_MINUTES)
    : 12;

/**
 * @param {string | undefined | null} input
 * @returns {PackageType}
 */
export function normalizePackageType(input) {
  if (input === "ai-self-photo") return "ai-self-photo";
  return "self-photo";
}

/**
 * @param {PackageType} packageType
 * @returns {number}
 */
export function getPackageDurationMinutes(packageType) {
  if (packageType === "ai-self-photo") {
    return AI_SELF_PHOTO_DURATION_MINUTES;
  }
  return SESSION_DURATION_MINUTES;
}

/**
 * @returns {Record<PackageType, number>}
 */
export function getPackageDurations() {
  return {
    "self-photo": SESSION_DURATION_MINUTES,
    "ai-self-photo": AI_SELF_PHOTO_DURATION_MINUTES,
  };
}

/**
 * AI generate quota equals people count for ai-self-photo packages.
 * @param {PackageType} packageType
 * @param {number} peopleCount
 * @returns {number}
 */
export function resolveAiGenerateLimit(packageType, peopleCount) {
  if (packageType !== "ai-self-photo") return 0;
  return Math.max(1, Math.min(8, Number(peopleCount) || 1));
}

/**
 * @param {object | null | undefined} customer
 * @returns {{ limit: number, used: number, remaining: number }}
 */
export function readAiQuotaFromCustomer(customer) {
  const packageType = normalizePackageType(customer?.packageType);
  const peopleCount = customer?.peopleCount ?? 1;
  const limit =
    packageType === "ai-self-photo"
      ? Math.max(
          0,
          Number(customer?.aiGenerateLimit) ||
            resolveAiGenerateLimit(packageType, peopleCount)
        )
      : 0;
  const used = Math.max(0, Number(customer?.aiGenerateUsed) || 0);
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining };
}

export function isAiGenerationEnabled() {
  return process.env.AI_GENERATION_ENABLED !== "false";
}

export function getAiGenerationConfig() {
  return {
    enabled: isAiGenerationEnabled(),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    timeoutMs: Number(process.env.AI_GENERATION_TIMEOUT_MS) || 120_000,
    maxConcurrent: Number(process.env.AI_GENERATION_MAX_CONCURRENT) || 2,
    defaultDurationMinutes: AI_SELF_PHOTO_DURATION_MINUTES,
    openaiQuality: (process.env.OPENAI_IMAGE_QUALITY || "medium").trim(),
    openaiInputFidelity: (process.env.OPENAI_IMAGE_INPUT_FIDELITY || "high").trim(),
    openaiResearchQuality: (process.env.OPENAI_RESEARCH_IMAGE_QUALITY || "low").trim(),
    openaiResearchInputFidelity: (
      process.env.OPENAI_RESEARCH_IMAGE_INPUT_FIDELITY || "low"
    ).trim(),
  };
}

/** @typedef {'production' | 'research'} OpenAiImageTier */

/**
 * OpenAI image tier: production (gallery) vs research (admin preview lab).
 * @param {OpenAiImageTier} [tier]
 */
export function getOpenAiImageTierOptions(tier = "production") {
  if (tier === "research") {
    return {
      quality: (process.env.OPENAI_RESEARCH_IMAGE_QUALITY || "low").trim(),
      inputFidelity: (process.env.OPENAI_RESEARCH_IMAGE_INPUT_FIDELITY || "low").trim(),
    };
  }

  return {
    quality: (process.env.OPENAI_IMAGE_QUALITY || "medium").trim(),
    inputFidelity: (process.env.OPENAI_IMAGE_INPUT_FIDELITY || "high").trim(),
  };
}

/** @typedef {{ id: string, label: string, description: string, quality: string, inputFidelity: string, recommended?: boolean }} ResearchQualityPreset */

/** @type {ResearchQualityPreset[]} */
export const RESEARCH_QUALITY_PRESETS = [
  {
    id: "economy",
    label: "Economy",
    description: "Iterasi prompt murah (~$0.02). Wajah/pose bisa bergeser — jangan dipakai untuk QA identitas.",
    quality: "low",
    inputFidelity: "low",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Kompromi biaya & detail (~$0.06). Cocok setelah prompt sudah stabil.",
    quality: "medium",
    inputFidelity: "medium",
  },
  {
    id: "identity",
    label: "Identity-first",
    description: "Sama dengan gallery production (~$0.08). Terbaik untuk cek kemiripan wajah sebelum publish.",
    quality: "medium",
    inputFidelity: "high",
    recommended: true,
  },
];

/**
 * @param {string} [presetId]
 * @returns {ResearchQualityPreset}
 */
export function resolveResearchQualityPreset(presetId) {
  const id = String(presetId ?? "identity").trim().toLowerCase();
  return RESEARCH_QUALITY_PRESETS.find((preset) => preset.id === id) ?? RESEARCH_QUALITY_PRESETS[2];
}
