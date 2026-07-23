/** @typedef {{ id: string, width: number, height: number }} ThemeSvgSpec */

const W = 1920;
const H = 1280;

/**
 * Rich SVG backgrounds for World Cup 2026 themes (rendered to PNG via Sharp).
 * @param {string} themeId
 * @returns {string | null}
 */
export function getThemeAssetSvg(themeId) {
  switch (themeId) {
    case "wc2026-stadium-night":
      return stadiumNightSvg();
    case "wc2026-celebration":
      return celebrationSvg();
    case "wc2026-indonesia-pride":
      return indonesiaPrideSvg();
    case "wc2026-victory":
      return victorySvg();
    case "studio-purple":
      return studioPurpleSvg();
    case "sunset-beach":
      return sunsetBeachSvg();
    case "neon-city":
      return neonCitySvg();
    case "nature-forest":
      return natureForestSvg();
    case "golden-hour":
      return goldenHourSvg();
    case "wild-west":
      return wildWestSvg();
    default:
      return null;
  }
}

/** @returns {string} */
function stadiumNightSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="55%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <radialGradient id="spotL" cx="25%" cy="15%" r="45%">
      <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#fef9c3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spotR" cx="75%" cy="15%" r="45%">
      <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#fef9c3" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#166534"/>
      <stop offset="100%" stop-color="#14532d"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#spotL)"/>
  <rect width="${W}" height="${H}" fill="url(#spotR)"/>
  <ellipse cx="960" cy="1180" rx="920" ry="180" fill="#0f172a" opacity="0.35"/>
  <rect x="0" y="780" width="${W}" height="500" fill="url(#field)"/>
  <rect x="120" y="820" width="1680" height="8" fill="#ffffff" opacity="0.12"/>
  <circle cx="960" cy="1020" r="90" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.18"/>
  <rect x="760" y="820" width="400" height="200" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.15"/>
  <text x="960" y="120" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#94a3b8" opacity="0.35" letter-spacing="8">FIFA WORLD CUP 2026</text>
  <text x="960" y="165" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#64748b" opacity="0.4">USA · MEXICO · CANADA</text>
</svg>`;
}

/** @returns {string} */
function celebrationSvg() {
  const confetti = Array.from({ length: 48 }, (_, i) => {
    const x = (i * 137) % W;
    const y = (i * 89) % (H - 200);
    const colors = ["#fbbf24", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316"];
    const c = colors[i % colors.length];
    const rot = (i * 37) % 360;
    return `<rect x="${x}" y="${y}" width="14" height="28" fill="${c}" opacity="0.75" transform="rotate(${rot} ${x} ${y})"/>`;
  }).join("");

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="45%" stop-color="#7c2d12"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="70%" r="50%">
      <stop offset="0%" stop-color="#fde68a" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#fde68a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${confetti}
  <text x="960" y="180" text-anchor="middle" font-family="Arial,sans-serif" font-size="56" font-weight="800" fill="#fef3c7" opacity="0.9">GOAL!</text>
  <text x="960" y="240" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" fill="#fde68a" opacity="0.65" letter-spacing="6">WORLD CUP 2026</text>
  <ellipse cx="960" cy="1050" rx="700" ry="80" fill="#000000" opacity="0.2"/>
</svg>`;
}

/** @returns {string} */
function indonesiaPrideSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="merah" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b91c1c"/>
      <stop offset="50%" stop-color="#dc2626"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <radialGradient id="shine" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#merah)"/>
  <rect width="${W}" height="${H}" fill="url(#shine)"/>
  <path d="M960 320 L1040 520 L1250 520 L1085 650 L1150 860 L960 730 L770 860 L835 650 L670 520 L880 520 Z" fill="#dc2626" opacity="0.12"/>
  <text x="960" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="48" font-weight="800" fill="#7f1d1d" opacity="0.55">GARUDA PRIDE</text>
  <text x="960" y="255" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#991b1b" opacity="0.45" letter-spacing="5">WORLD CUP 2026 · INDONESIA</text>
  <rect x="0" y="640" width="${W}" height="640" fill="#ffffff" opacity="0.08"/>
</svg>`;
}

/** @returns {string} */
function victorySvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#422006"/>
      <stop offset="35%" stop-color="#ca8a04"/>
      <stop offset="70%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <radialGradient id="burst" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#gold)"/>
  <rect width="${W}" height="${H}" fill="url(#burst)"/>
  <path d="M860 920 L920 680 L960 780 L1000 680 L1060 920 Z" fill="#fef3c7" opacity="0.35"/>
  <rect x="930" y="560" width="60" height="130" rx="8" fill="#fde68a" opacity="0.5"/>
  <ellipse cx="960" cy="560" rx="120" ry="40" fill="#fde68a" opacity="0.45"/>
  <text x="960" y="200" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="800" fill="#fffbeb" opacity="0.85">VICTORY</text>
  <text x="960" y="260" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#fef3c7" opacity="0.7" letter-spacing="6">FIFA WORLD CUP 2026</text>
  <ellipse cx="960" cy="1100" rx="750" ry="90" fill="#000000" opacity="0.18"/>
</svg>`;
}

/** @returns {string} */
function studioPurpleSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0a2e"/>
      <stop offset="55%" stop-color="#4c1d95"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
    <radialGradient id="key" cx="35%" cy="25%" r="55%">
      <stop offset="0%" stop-color="#e9d5ff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#e9d5ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="fill" cx="70%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2e1065"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  <rect width="${W}" height="${H}" fill="url(#key)"/>
  <rect width="${W}" height="${H}" fill="url(#fill)"/>
  <ellipse cx="960" cy="1180" rx="900" ry="120" fill="#000000" opacity="0.25"/>
  <rect x="0" y="900" width="${W}" height="380" fill="url(#floor)"/>
  <rect x="0" y="900" width="${W}" height="2" fill="#a78bfa" opacity="0.25"/>
</svg>`;
}

/** @returns {string} */
function sunsetBeachSvg() {
  const clouds = [
    { cx: 320, cy: 280, rx: 140, ry: 36 },
    { cx: 520, cy: 250, rx: 110, ry: 28 },
    { cx: 1380, cy: 300, rx: 160, ry: 40 },
    { cx: 1180, cy: 260, rx: 120, ry: 30 },
  ]
    .map(
      (c) =>
        `<ellipse cx="${c.cx}" cy="${c.cy}" rx="${c.rx}" ry="${c.ry}" fill="#fff7ed" opacity="0.35"/>`
    )
    .join("");

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="45%" stop-color="#f97316"/>
      <stop offset="75%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
    <radialGradient id="sun" cx="50%" cy="62%" r="22%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="#fbbf24" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${clouds}
  <circle cx="960" cy="720" r="120" fill="#fef08a" opacity="0.85"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <rect x="0" y="820" width="${W}" height="280" fill="url(#sea)"/>
  <path d="M0 820 Q240 800 480 820 T960 815 T1440 825 T1920 820 L1920 1100 L0 1100 Z" fill="#38bdf8" opacity="0.35"/>
  <rect x="0" y="1000" width="${W}" height="280" fill="url(#sand)"/>
  <ellipse cx="960" cy="1000" rx="980" ry="40" fill="#ffffff" opacity="0.12"/>
</svg>`;
}

/** @returns {string} */
function neonCitySvg() {
  const buildings = Array.from({ length: 18 }, (_, i) => {
    const x = 60 + i * 100;
    const h = 280 + (i * 73) % 420;
    const w = 70 + (i * 17) % 40;
    const y = 900 - h;
    const neon = ["#db2777", "#22d3ee", "#a855f7", "#f472b6"][i % 4];
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0f172a" opacity="0.92"/>
      <rect x="${x + 8}" y="${y + 40}" width="6" height="${h - 80}" fill="${neon}" opacity="0.45"/>
      <rect x="${x + w - 14}" y="${y + 60}" width="4" height="${h - 120}" fill="${neon}" opacity="0.3"/>`;
  }).join("");

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="night" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#312e81"/>
      <stop offset="100%" stop-color="#831843"/>
    </linearGradient>
    <radialGradient id="pink" cx="80%" cy="20%" r="45%">
      <stop offset="0%" stop-color="#f472b6" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#f472b6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cyan" cx="15%" cy="25%" r="40%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#night)"/>
  <rect width="${W}" height="${H}" fill="url(#pink)"/>
  <rect width="${W}" height="${H}" fill="url(#cyan)"/>
  ${buildings}
  <rect x="0" y="880" width="${W}" height="400" fill="#020617" opacity="0.55"/>
  <line x1="0" y1="900" x2="${W}" y2="900" stroke="#db2777" stroke-width="3" opacity="0.5"/>
</svg>`;
}

/** @returns {string} */
function natureForestSvg() {
  const bokeh = Array.from({ length: 36 }, (_, i) => {
    const x = (i * 211) % W;
    const y = (i * 137) % (H - 200);
    const r = 18 + (i * 13) % 55;
    const opacity = 0.08 + (i % 5) * 0.04;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#bbf7d0" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");

  const trees = Array.from({ length: 14 }, (_, i) => {
    const x = 80 + i * 130;
    const trunkH = 120 + (i * 29) % 80;
    const crownR = 70 + (i * 19) % 50;
    const yBase = 1050;
    return `<rect x="${x + 20}" y="${yBase - trunkH}" width="24" height="${trunkH}" fill="#3f2e1f" opacity="0.7"/>
      <circle cx="${x + 32}" cy="${yBase - trunkH - crownR * 0.4}" r="${crownR}" fill="#15803d" opacity="0.75"/>`;
  }).join("");

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="canopy" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#052e16"/>
      <stop offset="45%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#4ade80"/>
    </linearGradient>
    <radialGradient id="mist" cx="50%" cy="70%" r="55%">
      <stop offset="0%" stop-color="#ecfccb" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ecfccb" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#canopy)"/>
  <rect width="${W}" height="${H}" fill="url(#mist)"/>
  ${bokeh}
  ${trees}
  <rect x="0" y="1000" width="${W}" height="280" fill="#14532d" opacity="0.45"/>
</svg>`;
}

/** @returns {string} */
function goldenHourSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="40%" stop-color="#fb923c"/>
      <stop offset="75%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#9f1239"/>
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#fef9c3" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ca8a04" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#713f12" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#warm)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="1480" cy="320" r="100" fill="#fef08a" opacity="0.9"/>
  <ellipse cx="1480" cy="320" rx="280" ry="120" fill="#fde68a" opacity="0.25"/>
  <path d="M0 780 Q400 720 800 760 T1600 740 T1920 780 L1920 1280 L0 1280 Z" fill="url(#field)"/>
  <path d="M0 900 Q300 860 600 890 T1200 870 T1920 910" fill="none" stroke="#fff7ed" stroke-width="2" opacity="0.2"/>
</svg>`;
}

/** @returns {string} */
function wildWestSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7c2d12"/>
      <stop offset="35%" stop-color="#ea580c"/>
      <stop offset="70%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#fef3c7"/>
    </linearGradient>
    <radialGradient id="sun" cx="78%" cy="28%" r="35%">
      <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#fef9c3" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a16207" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#78350f" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <circle cx="1520" cy="300" r="88" fill="#fde68a" opacity="0.85"/>
  <rect x="0" y="720" width="${W}" height="560" fill="url(#ground)"/>
  <rect x="80" y="420" width="420" height="320" fill="#78350f" opacity="0.85"/>
  <polygon points="80,420 290,300 500,420" fill="#57534e"/>
  <rect x="120" y="500" width="80" height="120" fill="#292524" opacity="0.7"/>
  <rect x="280" y="520" width="90" height="100" fill="#292524" opacity="0.55"/>
  <rect x="1180" y="480" width="360" height="260" fill="#92400e" opacity="0.8"/>
  <polygon points="1180,480 1360,380 1540,480" fill="#44403c"/>
  <rect x="1240" y="560" width="70" height="110" fill="#1c1917" opacity="0.65"/>
  <rect x="1420" y="580" width="70" height="90" fill="#1c1917" opacity="0.5"/>
  <ellipse cx="1680" cy="860" rx="110" ry="140" fill="#78350f" opacity="0.75"/>
  <ellipse cx="1680" cy="820" rx="95" ry="70" fill="#57534e" opacity="0.55"/>
  <circle cx="220" cy="860" r="95" fill="none" stroke="#57534e" stroke-width="14" opacity="0.45"/>
  <rect x="0" y="980" width="${W}" height="300" fill="#713f12" opacity="0.35"/>
</svg>`;
}

export const WC2026_THEME_IDS = [
  "wc2026-stadium-night",
  "wc2026-celebration",
  "wc2026-indonesia-pride",
  "wc2026-victory",
];

export const CLASSIC_THEME_IDS = [
  "studio-purple",
  "sunset-beach",
  "neon-city",
  "nature-forest",
  "golden-hour",
];

export const AI_SELF_PHOTO_THEME_IDS = ["wild-west"];

export const THEME_ASSET_SIZE = { width: W, height: H };
