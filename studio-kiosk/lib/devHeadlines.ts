export type DevHeadline = {
  filename: string;
  url: string;
};

const PALETTES = [
  ["#2a1c12", "#E8C872", "#6b4a2b"],
  ["#121826", "#7dd3fc", "#1e3a5f"],
  ["#1a1024", "#e879f9", "#4a1d4a"],
  ["#141414", "#f5d0a9", "#3f3f3f"],
  ["#1b1410", "#fb923c", "#7c2d12"],
  ["#0f172a", "#38bdf8", "#082f49"],
  ["#1c1917", "#facc15", "#44403c"],
  ["#19101a", "#f9a8d4", "#701a3a"],
  ["#0c1a17", "#5eead4", "#115e59"],
  ["#1a1208", "#fde68a", "#78350f"],
  ["#111827", "#a5b4fc", "#312e81"],
  ["#1c1010", "#fca5a5", "#7f1d1d"],
];

function dummyPortraitDataUri(index: number) {
  const [bg, accent, mid] = PALETTES[index % PALETTES.length];
  const n = String(index + 1).padStart(2, "0");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1200" viewBox="0 0 720 1200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${bg}"/>
        <stop offset="1" stop-color="${mid}"/>
      </linearGradient>
    </defs>
    <rect width="720" height="1200" fill="url(#g)"/>
    <circle cx="360" cy="430" r="150" fill="${accent}" fill-opacity=".35"/>
    <rect x="210" y="620" width="300" height="420" rx="150" fill="${accent}" fill-opacity=".28"/>
    <text x="360" y="1120" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" fill="${accent}" fill-opacity=".9">Sample ${n}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Placeholder headlines for local/dev when /api/headline is empty or unavailable. */
export const DEV_DUMMY_HEADLINES: DevHeadline[] = Array.from(
  { length: 24 },
  (_, index) => ({
    filename: `dev-sample-${String(index + 1).padStart(2, "0")}.svg`,
    url: dummyPortraitDataUri(index),
  })
);

/** Client-safe: NODE_ENV is not always inlined in imported client modules. */
export const IS_DEV =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_SHOW_DUMMY_HEADLINES === "true";
