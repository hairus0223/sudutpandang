import {
  BOOTH_BG_HEIGHT,
  BOOTH_BG_WIDTH,
} from "./themeBackgroundSvgs.js";

const W = BOOTH_BG_WIDTH;
const H = BOOTH_BG_HEIGHT;

/**
 * Shared vignette + corner bracket frame (transparent center for subject).
 * @param {string} themeId
 * @returns {string | null}
 */
export function getThemeOverlayFrameSvg(themeId) {
  switch (themeId) {
    case "wild-west":
      return wildWestFrameSvg();
    case "cyberpunk-neon":
      return cyberpunkNeonFrameSvg();
    case "royal-fantasy":
      return royalFantasyFrameSvg();
    case "k-pop-idol":
      return kPopIdolFrameSvg();
    case "vintage-glam":
      return vintageGlamFrameSvg();
    case "anime-hero":
      return animeHeroFrameSvg();
    default:
      return null;
  }
}

function vignette(stops, cx = "50%", cy = "42%", r = "72%") {
  const gradientStops = stops
    .map(({ offset, color, opacity }) =>
      `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`
    )
    .join("");

  return `<radialGradient id="vig" cx="${cx}" cy="${cy}" r="${r}">
    ${gradientStops}
  </radialGradient>`;
}

function cornerBrackets(color, opacity = 0.75, size = 120, stroke = 8) {
  const s = size;
  const paths = [
    `M ${stroke} ${s} L ${stroke} ${stroke} L ${s} ${stroke}`,
    `M ${W - s} ${stroke} L ${W - stroke} ${stroke} L ${W - stroke} ${s}`,
    `M ${stroke} ${H - s} L ${stroke} ${H - stroke} L ${s} ${H - stroke}`,
    `M ${W - s} ${H - stroke} L ${W - stroke} ${H - stroke} L ${W - stroke} ${H - s}`,
  ];

  return paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${stroke}" stroke-linecap="round"/>`
    )
    .join("");
}

function wildWestFrameSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${vignette([
      { offset: "55%", color: "#000000", opacity: 0 },
      { offset: "100%", color: "#3d2314", opacity: 0.42 },
    ])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${cornerBrackets("#c4a574", 0.7, 140, 10)}
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="none" stroke="#8b6914" stroke-opacity="0.22" stroke-width="3" rx="8"/>
</svg>`;
}

function cyberpunkNeonFrameSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${vignette([
      { offset: "58%", color: "#000000", opacity: 0 },
      { offset: "100%", color: "#1a0a2e", opacity: 0.5 },
    ])}
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${cornerBrackets("#ec4899", 0.85, 130, 6)}
  <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="url(#neon)" stroke-width="4" rx="4" stroke-opacity="0.55"/>
  <line x1="0" y1="${H - 2}" x2="${W}" y2="${H - 2}" stroke="#06b6d4" stroke-opacity="0.35" stroke-width="4"/>
</svg>`;
}

function royalFantasyFrameSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${vignette([
      { offset: "52%", color: "#000000", opacity: 0 },
      { offset: "100%", color: "#2a0a0a", opacity: 0.48 },
    ])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${cornerBrackets("#d4af37", 0.8, 150, 9)}
  <rect x="42" y="42" width="${W - 84}" height="${H - 84}" fill="none" stroke="#7c2d12" stroke-opacity="0.25" stroke-width="4" rx="2"/>
  <circle cx="${W / 2}" cy="56" r="18" fill="#d4af37" fill-opacity="0.35"/>
</svg>`;
}

function kPopIdolFrameSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${vignette([
      { offset: "62%", color: "#ffffff", opacity: 0 },
      { offset: "100%", color: "#ec4899", opacity: 0.18 },
    ])}
    <linearGradient id="sparkle" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbcfe8" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#c4b5fd" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${cornerBrackets("#f472b6", 0.55, 110, 5)}
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="url(#sparkle)" stroke-width="5" rx="24"/>
</svg>`;
}

function vintageGlamFrameSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${vignette([
      { offset: "54%", color: "#000000", opacity: 0 },
      { offset: "100%", color: "#422006", opacity: 0.4 },
    ])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${cornerBrackets("#ca8a04", 0.75, 135, 7)}
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" fill="none" stroke="#ca8a04" stroke-opacity="0.3" stroke-width="3"/>
  <line x1="88" y1="88" x2="${W - 88}" y2="88" stroke="#ca8a04" stroke-opacity="0.2" stroke-width="2"/>
  <line x1="88" y1="${H - 88}" x2="${W - 88}" y2="${H - 88}" stroke="#ca8a04" stroke-opacity="0.2" stroke-width="2"/>
</svg>`;
}

function animeHeroFrameSvg() {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${vignette([
      { offset: "56%", color: "#000000", opacity: 0 },
      { offset: "100%", color: "#312e81", opacity: 0.38 },
    ])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${cornerBrackets("#6366f1", 0.7, 125, 6)}
  ${cornerBrackets("#f472b6", 0.45, 95, 4)}
  <circle cx="120" cy="180" r="6" fill="#fbcfe8" fill-opacity="0.6"/>
  <circle cx="${W - 140}" cy="220" r="5" fill="#c4b5fd" fill-opacity="0.55"/>
  <circle cx="200" cy="${H - 160}" r="4" fill="#fde68a" fill-opacity="0.5"/>
</svg>`;
}
