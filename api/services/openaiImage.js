import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getAiGenerationConfig, getOpenAiImageTierOptions } from "./packageTypes.js";
import { normalizeMaskForOpenAiEdit } from "./personMask.js";
import { buildOpenAiUsageRecord } from "./openAiPricing.js";
import { logAiAnalyticsEvent } from "./aiAnalytics.js";

const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
const OPENAI_SOURCE_MAX_EDGE =
  Number(process.env.OPENAI_IMAGE_SOURCE_MAX_EDGE) || 2048;

export const OPENAI_MASKED_EDIT_ENABLED =
  process.env.OPENAI_MASKED_EDIT_ENABLED !== "false";

/**
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
function pickOpenAiSize(width, height) {
  const portrait = height >= width;
  if (portrait) return "1024x1536";
  return "1536x1024";
}

/**
 * Normalize camera/upload JPEGs for OpenAI edits (EXIF rotate, max edge, standard JPEG).
 * @param {string} imagePath
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
export async function prepareSourceImageForOpenAi(imagePath) {
  const pipeline = sharp(imagePath).rotate().resize({
    width: OPENAI_SOURCE_MAX_EDGE,
    height: OPENAI_SOURCE_MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });

  const buffer = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  const meta = await sharp(buffer).metadata();
  return {
    buffer,
    width: meta.width || 1024,
    height: meta.height || 1536,
  };
}

/**
 * @param {Response} res
 * @param {AbortSignal} signal
 * @returns {Promise<Buffer>}
 */
async function readOpenAiImagePayload(res, body, signal) {
  if (!res.ok) {
    throw new Error(mapOpenAiError(res.status, body));
  }

  const item = /** @type {{ b64_json?: string, url?: string } | undefined} */ (
    body?.data?.[0]
  );

  if (item?.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item?.url) {
    const imgRes = await fetch(item.url, { signal });
    if (!imgRes.ok) {
      throw new Error("openai_empty_response");
    }
    return Buffer.from(await imgRes.arrayBuffer());
  }

  throw new Error("openai_empty_response");
}

/**
 * @param {FormData} form
 * @param {AbortSignal} signal
 * @param {number} timeoutMs
 * @returns {Promise<Buffer>}
 */
async function postOpenAiImageForm(form, signal, timeoutMs) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("openai_not_configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = body?.error?.message || res.statusText;
      console.warn(`[openai] edits failed ${res.status}:`, errMsg);
    }
    return readOpenAiImagePayload(res, body, controller.signal);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("openai_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * @param {number} status
 * @param {unknown} body
 * @returns {string}
 */
function mapOpenAiError(status, body) {
  const err = /** @type {{ error?: { message?: string, code?: string, type?: string } }} */ (
    body
  );
  const message = err?.error?.message || `OpenAI HTTP ${status}`;

  if (status === 401) return "openai_unauthorized";
  if (status === 429) return "openai_rate_limited";
  if (status === 400 && /content/i.test(message)) return "openai_content_policy";
  if (status >= 500) return "openai_unavailable";

  return `openai_error:${message.slice(0, 120)}`;
}

/**
 * @param {string} code
 * @returns {string}
 */
export function mapOpenAiErrorToUserMessage(code) {
  switch (code) {
    case "openai_not_configured":
      return "Layanan AI belum dikonfigurasi. Hubungi staf.";
    case "openai_unauthorized":
      return "Kunci API OpenAI tidak valid. Hubungi staf.";
    case "openai_rate_limited":
      return "Layanan AI sibuk. Coba lagi sebentar lagi.";
    case "openai_content_policy":
      return "Gambar tidak dapat diproses oleh AI. Pilih foto lain.";
    case "openai_unavailable":
      return "Layanan AI sedang tidak tersedia. Coba lagi.";
    case "openai_timeout":
      return "Generate AI terlalu lama. Coba lagi.";
    case "openai_empty_response":
      return "AI tidak mengembalikan gambar. Coba lagi.";
    case "edit_mask_not_found":
      return "Mask edit tidak ditemukan. Silakan ambil ulang foto.";
    case "edit_mask_invalid":
      return "Mask edit tidak valid. Hubungi staf.";
    default:
      if (code.startsWith("openai_error:")) {
        return `Generate AI gagal: ${code.slice("openai_error:".length)}`;
      }
      return "Generate AI gagal. Coba lagi atau hubungi staf.";
  }
}

/**
 * @param {{
 *   model: string,
 *   fullPrompt: string,
 *   imageBytes: Buffer,
 *   sourceWidth: number,
 *   sourceHeight: number,
 *   quality: string,
 *   inputFidelity: string,
 *   maskBytes?: Buffer | null,
 * }} params
 */
function buildOpenAiEditForm({
  model,
  fullPrompt,
  imageBytes,
  sourceWidth,
  sourceHeight,
  quality,
  inputFidelity,
  maskBytes,
}) {
  const size = pickOpenAiSize(sourceWidth, sourceHeight);
  const blob = new Blob([imageBytes], { type: "image/jpeg" });

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", fullPrompt);
  form.append("image", blob, "source.jpg");
  form.append("size", size);
  form.append("quality", quality);

  const isGptImageModel = /^gpt-image/i.test(model);
  if (isGptImageModel) {
    const outputFormat = (process.env.OPENAI_IMAGE_OUTPUT_FORMAT || "jpeg").trim();
    form.append("output_format", outputFormat);
    form.append("input_fidelity", inputFidelity);
  } else {
    form.append("response_format", "b64_json");
  }

  if (maskBytes) {
    const maskBlob = new Blob([maskBytes], { type: "image/png" });
    form.append("mask", maskBlob, "mask.png");
  }

  form.append("n", "1");
  return form;
}

/**
 * @param {{ maskPath?: string, maskBuffer?: Buffer, width: number, height: number }} params
 */
async function resolveOpenAiMaskBytes({ maskPath, maskBuffer, width, height }) {
  if (maskBuffer) {
    return normalizeMaskForOpenAiEdit(maskBuffer, width, height);
  }

  if (maskPath) {
    if (!fs.existsSync(maskPath)) {
      throw new Error("edit_mask_not_found");
    }
    const raw = await fs.promises.readFile(maskPath);
    return normalizeMaskForOpenAiEdit(raw, width, height);
  }

  return null;
}

/**
 * Transform a portrait via OpenAI Images Edits API (identity-preserving restyle).
 * @param {{
 *   imagePath: string,
 *   prompt: string,
 *   negativePrompt?: string,
 *   width: number,
 *   height: number,
 *   useSoftPromptFallback?: boolean,
 *   tier?: import("./packageTypes.js").OpenAiImageTier,
 *   imageQuality?: string,
 *   imageInputFidelity?: string,
 *   maskPath?: string,
 *   maskBuffer?: Buffer,
 *   billing?: {
 *     baseDir: string,
 *     source: "gallery" | "research" | "smoke-test",
 *     themeId?: string,
 *     jobId?: string,
 *     runId?: string,
 *     draftId?: string,
 *     imageId?: string,
 *     user?: string,
 *   },
 * }} params
 * @returns {Promise<Buffer>}
 */
export async function generateTransformedImage({
  imagePath,
  prompt,
  negativePrompt,
  width,
  height,
  useSoftPromptFallback = false,
  tier = "production",
  imageQuality,
  imageInputFidelity,
  maskPath,
  maskBuffer,
  billing,
}) {
  if (!fs.existsSync(imagePath)) {
    throw new Error("original_not_found");
  }

  const { timeoutMs } = getAiGenerationConfig();
  const tierDefaults = getOpenAiImageTierOptions(tier);
  const quality = (imageQuality ?? tierDefaults.quality).trim();
  const inputFidelity = (imageInputFidelity ?? tierDefaults.inputFidelity).trim();
  const model = (process.env.OPENAI_IMAGE_MODEL || "gpt-image-1").trim();

  const softenedPrompt = useSoftPromptFallback
    ? prompt
        .replace(/holster[^\n.]*/gi, "")
        .replace(/rope[^\n.]*/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    : prompt;

  const fullPrompt = negativePrompt
    ? `${softenedPrompt}\n\nAvoid: ${negativePrompt}`
    : softenedPrompt;

  const { buffer: imageBytes, width: sourceWidth, height: sourceHeight } =
    await prepareSourceImageForOpenAi(imagePath);

  let maskBytes = null;
  if (maskPath || maskBuffer) {
    try {
      maskBytes = await resolveOpenAiMaskBytes({
        maskPath,
        maskBuffer,
        width: sourceWidth,
        height: sourceHeight,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      if (code === "edit_mask_not_found" || code === "edit_mask_invalid") {
        throw err;
      }
      throw new Error("edit_mask_invalid");
    }
  }

  const form = buildOpenAiEditForm({
    model,
    fullPrompt,
    imageBytes,
    sourceWidth,
    sourceHeight,
    quality,
    inputFidelity,
    maskBytes,
  });
  const size = pickOpenAiSize(sourceWidth, sourceHeight);

  try {
    const result = await postOpenAiImageForm(form, undefined, timeoutMs);
    if (maskBytes) {
      console.log(
        `[openai] masked edit ${sourceWidth}x${sourceHeight} tier=${tier} quality=${quality}`
      );
    }

    if (billing?.baseDir && billing.source) {
      logAiAnalyticsEvent(billing.baseDir, buildOpenAiUsageRecord({
        tier,
        quality,
        inputFidelity,
        size,
        masked: Boolean(maskBytes),
        source: billing.source,
        model,
        themeId: billing.themeId,
        jobId: billing.jobId,
        runId: billing.runId,
        draftId: billing.draftId,
        imageId: billing.imageId,
        user: billing.user,
      }));
    }

    return result;
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === "openai_content_policy" && !useSoftPromptFallback) {
      console.warn("[openai] transform content policy — retrying with softened prompt");
      return generateTransformedImage({
        imagePath,
        prompt,
        negativePrompt,
        width,
        height,
        useSoftPromptFallback: true,
        tier,
        imageQuality: quality,
        imageInputFidelity: inputFidelity,
        maskPath,
        maskBuffer,
        billing,
      });
    }
    throw err;
  }
}

/**
 * Masked costume edit — convenience wrapper requiring a mask path or buffer.
 * @param {Omit<Parameters<typeof generateTransformedImage>[0], "maskPath" | "maskBuffer"> & ({ maskPath: string } | { maskBuffer: Buffer })} params
 */
export async function generateMaskedTransformedImage(params) {
  if (!params.maskPath && !params.maskBuffer) {
    throw new Error("edit_mask_invalid");
  }
  return generateTransformedImage(params);
}
