/**
 * Estimated OpenAI Images (gpt-image-1) cost per edit call.
 * Override via env — values are approximate USD per image.
 */

/** @type {Record<string, number>} */
const PRICE_BY_QUALITY_FIDELITY = {
  low_low: Number(process.env.OPENAI_COST_USD_LOW_LOW) || 0.02,
  low_medium: Number(process.env.OPENAI_COST_USD_LOW_MEDIUM) || 0.03,
  medium_low: Number(process.env.OPENAI_COST_USD_MEDIUM_LOW) || 0.05,
  medium_medium: Number(process.env.OPENAI_COST_USD_MEDIUM_MEDIUM) || 0.06,
  medium_high: Number(process.env.OPENAI_COST_USD_MEDIUM_HIGH) || 0.08,
  high_high: Number(process.env.OPENAI_COST_USD_HIGH_HIGH) || 0.12,
};

/**
 * @param {{
 *   tier?: import("./packageTypes.js").OpenAiImageTier,
 *   quality?: string,
 *   inputFidelity?: string,
 * }} params
 * @returns {number}
 */
export function estimateOpenAiImageCostUsd({ tier = "production", quality, inputFidelity }) {
  const q = String(quality ?? "medium").trim().toLowerCase();
  const f = String(inputFidelity ?? "high").trim().toLowerCase();
  const key = `${q}_${f}`;

  if (Number.isFinite(PRICE_BY_QUALITY_FIDELITY[key])) {
    return PRICE_BY_QUALITY_FIDELITY[key];
  }

  if (tier === "research") {
    return Number(process.env.OPENAI_COST_RESEARCH_USD) || 0.02;
  }

  return Number(process.env.OPENAI_COST_PRODUCTION_USD) || 0.08;
}

/**
 * @param {number} usd
 * @returns {string}
 */
export function formatUsd(usd) {
  if (!Number.isFinite(usd)) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * @param {{
 *   tier?: import("./packageTypes.js").OpenAiImageTier,
 *   quality: string,
 *   inputFidelity: string,
 *   size: string,
 *   masked?: boolean,
 *   source: "gallery" | "research" | "smoke-test",
 *   model?: string,
 *   themeId?: string | null,
 *   jobId?: string | null,
 *   runId?: string | null,
 *   draftId?: string | null,
 *   imageId?: string | null,
 *   user?: string | null,
 * }} params
 */
export function buildOpenAiUsageRecord({
  tier = "production",
  quality,
  inputFidelity,
  size,
  masked = false,
  source,
  model,
  themeId,
  jobId,
  runId,
  draftId,
  imageId,
  user,
}) {
  const costUsd = estimateOpenAiImageCostUsd({ tier, quality, inputFidelity });

  return {
    type: "openai_usage",
    source,
    tier,
    quality,
    inputFidelity,
    size,
    masked: Boolean(masked),
    costUsd,
    model: model || (process.env.OPENAI_IMAGE_MODEL || "gpt-image-1").trim(),
    ...(themeId ? { themeId } : {}),
    ...(jobId ? { jobId } : {}),
    ...(runId ? { runId } : {}),
    ...(draftId ? { draftId } : {}),
    ...(imageId ? { imageId } : {}),
    ...(user ? { user } : {}),
  };
}

/**
 * Public pricing hints for admin UI.
 */
export function getOpenAiPricingHints() {
  const research = estimateOpenAiImageCostUsd({
    tier: "research",
    quality: "low",
    inputFidelity: "low",
  });
  const production = estimateOpenAiImageCostUsd({
    tier: "production",
    quality: "medium",
    inputFidelity: "high",
  });

  return {
    researchPreviewUsd: research,
    productionGenerateUsd: production,
    formatted: {
      researchPreview: formatUsd(research),
      productionGenerate: formatUsd(production),
    },
  };
}
