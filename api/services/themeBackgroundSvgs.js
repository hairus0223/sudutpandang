/** Portrait booth backgrounds — 3:4 ratio for AI Self Photo composite. */

export const BOOTH_BG_WIDTH = 1536;
export const BOOTH_BG_HEIGHT = 2048;

/** @type {string[]} */
export const BOOTH_BACKGROUND_THEME_IDS = [
  "wild-west",
  "cyberpunk-neon",
  "royal-fantasy",
  "k-pop-idol",
  "vintage-glam",
  "anime-hero",
];

const W = BOOTH_BG_WIDTH;
const H = BOOTH_BG_HEIGHT;

/**
 * @param {string} themeId
 * @returns {string | null}
 */
export function getBoothBackgroundSvg(themeId) {
  switch (themeId) {
    case "wild-west":
      return wildWestBoothSvg();
    case "cyberpunk-neon":
      return cyberpunkNeonBoothSvg();
    case "royal-fantasy":
      return royalFantasyBoothSvg();
    case "k-pop-idol":
      return kPopIdolBoothSvg();
    case "vintage-glam":
      return vintageGlamBoothSvg();
    case "anime-hero":
      return animeHeroBoothSvg();
    default:
      return null;
  }
}

/** Empty lower ~45% for subject placement. */
function wildWestBoothSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e3a5f"/>
      <stop offset="45%" stop-color="#c2410c" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="sun" cx="72%" cy="18%" r="35%">
      <stop offset="0%" stop-color="#fef3c7" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#fef3c7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#92400e" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#78350f" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <rect x="40" y="520" width="340" height="380" fill="#78350f" opacity="0.88"/>
  <polygon points="40,520 210,400 380,520" fill="#57534e"/>
  <rect x="90" y="620" width="70" height="110" fill="#292524" opacity="0.65"/>
  <rect x="1120" y="480" width="380" height="420" fill="#92400e" opacity="0.82"/>
  <polygon points="1120,480 1310,350 1500,480" fill="#44403c"/>
  <rect x="1180" y="590" width="80" height="120" fill="#1c1917" opacity="0.55"/>
  <rect x="0" y="1120" width="${W}" height="928" fill="url(#ground)"/>
  <ellipse cx="1280" cy="1180" rx="90" ry="55" fill="#57534e" opacity="0.4"/>
</svg>`;
}

function cyberpunkNeonBoothSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#db2777"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect x="80" y="280" width="200" height="520" fill="#1e293b" opacity="0.92"/>
  <rect x="380" y="360" width="260" height="440" fill="#312e81" opacity="0.88"/>
  <rect x="820" y="240" width="220" height="560" fill="#1e293b" opacity="0.9"/>
  <rect x="1180" y="320" width="280" height="480" fill="#4c1d95" opacity="0.85"/>
  <rect x="60" y="1080" width="${W - 120}" height="12" fill="url(#neon)" opacity="0.8"/>
  <rect x="0" y="1120" width="${W}" height="928" fill="#020617" opacity="0.75"/>
  <ellipse cx="768" cy="1180" rx="420" ry="40" fill="#06b6d4" opacity="0.15"/>
  <rect x="420" y="480" width="140" height="44" fill="#ec4899" opacity="0.55"/>
  <rect x="960" y="440" width="180" height="40" fill="#06b6d4" opacity="0.5"/>
</svg>`;
}

function royalFantasyBoothSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#292524"/>
      <stop offset="100%" stop-color="#1c1917"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="220" height="${H}" fill="#7f1d1d" opacity="0.6"/>
  <rect x="${W - 220}" y="0" width="220" height="${H}" fill="#7f1d1d" opacity="0.6"/>
  <rect x="520" y="680" width="496" height="380" fill="#991b1b" opacity="0.75" rx="6"/>
  <polygon points="520,680 768,560 1016,680" fill="#b45309" opacity="0.88"/>
  <rect x="580" y="760" width="70" height="180" fill="#fcd34d" opacity="0.22"/>
  <rect x="886" y="760" width="70" height="180" fill="#fcd34d" opacity="0.22"/>
  <rect x="0" y="1120" width="${W}" height="928" fill="#292524" opacity="0.55"/>
</svg>`;
}

function kPopIdolBoothSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fce7f3"/>
      <stop offset="50%" stop-color="#fbcfe8"/>
      <stop offset="100%" stop-color="#ddd6fe"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="32%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#spot)"/>
  <circle cx="280" cy="420" r="140" fill="#f472b6" opacity="0.18"/>
  <circle cx="1250" cy="500" r="180" fill="#a78bfa" opacity="0.15"/>
  <rect x="0" y="1120" width="${W}" height="928" fill="#fdf2f8" opacity="0.45"/>
</svg>`;
}

function vintageGlamBoothSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#422006"/>
      <stop offset="50%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#1c1917"/>
    </linearGradient>
    <pattern id="deco" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M0 36 H72 M36 0 V72" stroke="#fbbf24" stroke-width="1.5" opacity="0.12"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#gold)"/>
  <rect width="${W}" height="${H}" fill="url(#deco)"/>
  <circle cx="768" cy="380" r="160" fill="#fde68a" opacity="0.22"/>
  <rect x="100" y="620" width="${W - 200}" height="460" fill="#292524" opacity="0.32" rx="4"/>
  <rect x="0" y="1120" width="${W}" height="928" fill="#422006" opacity="0.35"/>
  <ellipse cx="768" cy="1180" rx="360" ry="50" fill="#fbbf24" opacity="0.12"/>
</svg>`;
}

function animeHeroBoothSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#312e81"/>
      <stop offset="55%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#fda4af"/>
    </linearGradient>
    <radialGradient id="beam" cx="50%" cy="22%" r="65%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#beam)"/>
  <circle cx="220" cy="480" r="10" fill="#fbcfe8" opacity="0.85"/>
  <circle cx="480" cy="360" r="8" fill="#fde68a" opacity="0.8"/>
  <circle cx="1180" cy="420" r="12" fill="#fbcfe8" opacity="0.75"/>
  <circle cx="1380" cy="560" r="9" fill="#c4b5fd" opacity="0.85"/>
  <rect x="0" y="1120" width="${W}" height="928" fill="#4338ca" opacity="0.28"/>
  <ellipse cx="768" cy="1180" rx="520" ry="70" fill="#6366f1" opacity="0.2"/>
</svg>`;
}
