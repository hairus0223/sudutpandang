import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  BOOTH_BG_HEIGHT,
  BOOTH_BG_WIDTH,
} from "./themeBackgroundSvgs.js";
import { getBoothBackgroundPrompt } from "./themeBackgroundPrompts.js";

const OPENAI_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_GEN_TIMEOUT_MS =
  Number(process.env.OPENAI_BACKGROUND_GEN_TIMEOUT_MS) || 180_000;

/**
 * @param {number} status
 * @param {unknown} body
 */
function mapOpenAiGenError(status, body) {
  const err = /** @type {{ error?: { message?: string } }} */ (body);
  const message = err?.error?.message || `OpenAI HTTP ${status}`;

  if (status === 401) return "openai_unauthorized";
  if (status === 429) return "openai_rate_limited";
  if (status >= 500) return "openai_unavailable";

  return `openai_error:${message.slice(0, 160)}`;
}

/**
 * @param {Response} res
 * @param {unknown} body
 * @param {AbortSignal} signal
 */
async function readGeneratedImageBuffer(res, body, signal) {
  if (!res.ok) {
    throw new Error(mapOpenAiGenError(res.status, body));
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
 * Generate a photorealistic booth background via OpenAI Images API.
 * @param {{
 *   themeId: string,
 *   quality?: string,
 *   model?: string,
 * }} params
 * @returns {Promise<{ buffer: Buffer, model: string, quality: string, size: string }>}
 */
export async function generateBoothBackgroundWithOpenAi({
  themeId,
  quality = (process.env.OPENAI_BACKGROUND_QUALITY || "medium").trim(),
  model = (process.env.OPENAI_IMAGE_MODEL || "gpt-image-1").trim(),
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("openai_not_configured");
  }

  const spec = getBoothBackgroundPrompt(themeId);
  if (!spec) {
    throw new Error(`unknown_theme:${themeId}`);
  }

  const size = "1024x1536";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_GEN_TIMEOUT_MS);

  /** @type {Record<string, unknown>} */
  const payload = {
    model,
    prompt: spec.prompt,
    size,
    quality,
    n: 1,
  };

  if (/^gpt-image/i.test(model)) {
    payload.output_format = "jpeg";
  } else {
    payload.response_format = "b64_json";
  }

  try {
    const res = await fetch(OPENAI_GENERATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = body?.error?.message || res.statusText;
      console.warn(`[openai-bg] generation failed ${res.status}:`, errMsg);
    }

    const rawBuffer = await readGeneratedImageBuffer(res, body, controller.signal);

    const buffer = await sharp(rawBuffer)
      .resize(BOOTH_BG_WIDTH, BOOTH_BG_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    console.log(
      `[openai-bg] ${themeId} ${BOOTH_BG_WIDTH}x${BOOTH_BG_HEIGHT} model=${model} quality=${quality}`
    );

    return { buffer, model, quality, size };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("openai_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} outPath
 * @param {Buffer} buffer
 */
export async function writeBoothBackgroundJpeg(outPath, buffer) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, buffer);
}
