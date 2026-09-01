/**
 * Pro photo booth background prompts — photorealistic, no people.
 * Used by OpenAI image generation for bundled theme backgrounds.
 */

/** @type {Record<string, { label: string, prompt: string }>} */
export const BOOTH_BACKGROUND_PROMPTS = {
  "wild-west": {
    label: "Wild West",
    prompt: [
      "Ultra photorealistic professional photo booth backdrop, vertical portrait 3:4 composition.",
      "Authentic Old West frontier main street at golden hour: weathered wooden saloon facades, dusty ground, warm sunset backlight, cinematic depth of field, subtle film grain.",
      "CRITICAL: completely empty scene — absolutely no people, no humans, no silhouettes, no animals.",
      "Leave the lower 45% of the frame as clear open ground space where a standing portrait subject will be composited later — unobstructed floor area, natural perspective.",
      "Shot like a high-end event photography backdrop, sharp architectural detail, natural color grading, 85mm lens look.",
    ].join(" "),
  },
  "cyberpunk-neon": {
    label: "Cyberpunk Neon",
    prompt: [
      "Ultra photorealistic cyberpunk city street at night, professional portrait booth backdrop, vertical 3:4.",
      "Rain-slick pavement with neon reflections, magenta and cyan signage, holographic ads, moody atmospheric haze, cinematic bokeh lights, Blade Runner inspired but clean and commercial.",
      "CRITICAL: no people, no humans, no figures anywhere in the image.",
      "Lower 45% must be open wet street surface for compositing a full-body subject — no obstacles, no parked vehicles blocking center.",
      "High-end commercial photography quality, realistic lighting, subtle lens flare.",
    ].join(" "),
  },
  "royal-fantasy": {
    label: "Royal Fantasy",
    prompt: [
      "Ultra photorealistic medieval royal throne room interior, luxury event portrait backdrop, vertical 3:4.",
      "Stone arches, rich red velvet drapes, golden candlelight, ornate throne softly blurred in background, regal warm atmosphere, shallow depth of field.",
      "CRITICAL: empty room — no people, no knights, no statues of humans.",
      "Lower 45% clear polished stone floor for standing portrait subject composite — center aisle open.",
      "Museum-quality realism, soft rim lighting, professional interior photography.",
    ].join(" "),
  },
  "k-pop-idol": {
    label: "K-Pop Idol",
    prompt: [
      "Ultra photorealistic K-pop idol studio photoshoot backdrop, vertical 3:4 portrait orientation.",
      "Soft pastel gradient from blush pink to lavender, professional beauty dish lighting, clean minimalist music-label aesthetic, subtle glossy floor reflection.",
      "CRITICAL: empty studio — no people, no idols, no mannequins.",
      "Lower 45% open studio floor space for full-body subject composite, seamless backdrop curve.",
      "High-end Seoul entertainment agency photoshoot quality, flawless but natural.",
    ].join(" "),
  },
  "vintage-glam": {
    label: "Vintage Glam",
    prompt: [
      "Ultra photorealistic 1920s Art Deco ballroom interior, Hollywood glamour portrait backdrop, vertical 3:4.",
      "Gold geometric wall patterns, warm champagne lighting, soft bokeh from crystal chandeliers, black and gold elegant atmosphere.",
      "CRITICAL: empty ballroom — no people, no dancers, no guests.",
      "Lower 45% clear polished dance floor for standing subject composite, center of frame unobstructed.",
      "Classic red-carpet event photography, subtle vintage film tone, sharp detail.",
    ].join(" "),
  },
  "anime-hero": {
    label: "Anime Hero",
    prompt: [
      "Photorealistic cinematic anime-inspired hero environment backdrop for portrait booth, vertical 3:4.",
      "Dramatic sky with volumetric god rays, floating sakura petals, vibrant purple and rose gradient horizon, epic but clean composition — semi-realistic environment art, not cartoon.",
      "CRITICAL: no people, no anime characters, no figures.",
      "Lower 45% open ground or platform for full-body subject composite, center clear.",
      "Professional concept art quality rendered as a real photograph, depth and atmosphere.",
    ].join(" "),
  },
};

/**
 * @param {string} themeId
 * @returns {{ label: string, prompt: string } | null}
 */
export function getBoothBackgroundPrompt(themeId) {
  return BOOTH_BACKGROUND_PROMPTS[themeId] ?? null;
}
