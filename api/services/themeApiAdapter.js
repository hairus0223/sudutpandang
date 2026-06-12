const DEFAULT_HF_MODEL =
  "stabilityai/stable-diffusion-xl-base-1.0";

const THEME_API_URL = process.env.THEME_API_URL?.trim() || "";
const THEME_API_KEY = process.env.THEME_API_KEY?.trim() || "";
const THEME_API_PROVIDER = (
  process.env.THEME_API_PROVIDER || "generic"
).trim().toLowerCase();

const THEME_API_TIMEOUT_MS =
  Number(process.env.THEME_API_TIMEOUT_MS) || 90_000;

/**
 * @returns {boolean}
 */
export function isThemeApiConfigured() {
  return Boolean(THEME_API_URL && THEME_API_KEY);
}

/**
 * @returns {{ provider: string, configured: boolean, url: string | null }}
 */
export function getThemeApiStatus() {
  return {
    provider: THEME_API_PROVIDER,
    configured: isThemeApiConfigured(),
    url: THEME_API_URL || null,
  };
}

/**
 * @param {Response} res
 */
async function readImageResponse(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await res.json();
    const base64 =
      json?.image ||
      json?.data?.[0]?.b64_json ||
      json?.output?.[0] ||
      json?.artifacts?.[0]?.base64;

    if (typeof base64 === "string" && base64.length > 0) {
      return Buffer.from(base64, "base64");
    }

    throw new Error("Theme API JSON response missing image data");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 64) {
    throw new Error("Theme API returned empty image");
  }

  return buffer;
}

/**
 * @param {string} url
 * @param {RequestInit} init
 */
async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), THEME_API_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ prompt: string, width: number, height: number }} params
 */
async function fetchHuggingFaceBackground({ prompt, width, height }) {
  const model = THEME_API_URL.includes("huggingface.co")
    ? THEME_API_URL
    : `https://api-inference.huggingface.co/models/${THEME_API_URL || DEFAULT_HF_MODEL}`;

  const negative =
    "people, person, face, text, watermark, logo, blurry, low quality";

  const res = await fetchWithTimeout(model, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${THEME_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify({
      inputs: `${prompt}, portrait photography background, shallow depth of field`,
      parameters: {
        negative_prompt: negative,
        width: Math.min(Math.max(width, 512), 1024),
        height: Math.min(Math.max(height, 512), 1024),
        num_inference_steps: 25,
        guidance_scale: 7.5,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `HuggingFace theme API failed: ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`
    );
  }

  return readImageResponse(res);
}

/**
 * @param {{ prompt: string, width: number, height: number }} params
 */
async function fetchGenericBackground({ prompt, width, height }) {
  const res = await fetchWithTimeout(THEME_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${THEME_API_KEY}`,
      Accept: "image/png, application/octet-stream, */*",
    },
    body: JSON.stringify({ prompt, width, height }),
  });

  if (!res.ok) {
    throw new Error(`Theme API failed: ${res.status}`);
  }

  return readImageResponse(res);
}

/**
 * Fetch background image bytes from configured external provider.
 * @param {{ prompt: string, width: number, height: number, themeId?: string }} params
 * @returns {Promise<Buffer>}
 */
export async function fetchThemeBackgroundFromApi(params) {
  if (!isThemeApiConfigured()) {
    throw new Error("Theme API not configured");
  }

  if (THEME_API_PROVIDER === "huggingface" || THEME_API_PROVIDER === "hf") {
    return fetchHuggingFaceBackground(params);
  }

  return fetchGenericBackground(params);
}
