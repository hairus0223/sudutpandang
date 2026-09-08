"use client";

import { cn } from "@/lib/utils";

type PassportGuideOverlayProps = {
  color?: string | null;
  visible?: boolean;
  compact?: boolean;
};

/** Same ICAO-ish 3×4 proportions as the kiosk live guide. */
const HEAD = { cx: 150, cy: 162, rx: 87, ry: 128 };
const EYE_Y = 142;

export function PassportGuideOverlay({
  color = "#438CCB",
  visible = true,
  compact = false,
}: PassportGuideOverlayProps) {
  if (!visible) return null;
  const frameStroke = color || "#438CCB";
  const tx = HEAD.cx;
  const ty = HEAD.cy;
  const trx = HEAD.rx;
  const tryR = HEAD.ry;
  const neckTop = ty + tryR - 4;
  const shoulder = `M ${tx - 26} ${neckTop}
    C ${tx - 24} ${neckTop + 26}, ${tx - 56} ${neckTop + 50}, ${tx - 118} ${neckTop + 66}
    C ${tx - 150} ${neckTop + 82}, 12 358, 8 400
    L 292 400
    C 288 358, ${tx + 150} ${neckTop + 82}, ${tx + 118} ${neckTop + 66}
    C ${tx + 56} ${neckTop + 50}, ${tx + 24} ${neckTop + 26}, ${tx + 26} ${neckTop} Z`;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"
      aria-hidden
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[10px]",
          compact ? "h-[72%] max-h-[420px]" : "h-[78%] max-h-[560px]"
        )}
        style={{ aspectRatio: "3 / 4", border: `1.5px solid ${frameStroke}` }}
      >
        <svg viewBox="0 0 300 400" className="absolute inset-0 size-full">
          <defs>
            <radialGradient id="passportBustFill" cx="50%" cy="36%" r="64%">
              <stop offset="0%" stopColor="#f0d0b4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <mask id="studioPasHole">
              <rect width="300" height="400" fill="white" />
              <ellipse cx={tx} cy={ty} rx={trx} ry={tryR} fill="black" />
              <path d={shoulder} fill="black" />
            </mask>
          </defs>
          <rect
            width="300"
            height="400"
            fill="rgba(0,0,0,0.4)"
            mask="url(#studioPasHole)"
          />
          <ellipse cx={tx} cy={ty} rx={trx} ry={tryR} fill="url(#passportBustFill)" />
          <ellipse
            cx={tx}
            cy={ty}
            rx={trx}
            ry={tryR}
            fill="none"
            stroke="#4ade80"
            strokeWidth="1.35"
          />
          <path d={shoulder} fill="none" stroke="#4ade80" strokeWidth="1.2" />
          <line
            x1={tx - trx + 14}
            y1={EYE_Y}
            x2={tx + trx - 14}
            y2={EYE_Y}
            stroke="rgba(250,204,21,0.75)"
            strokeWidth="1.1"
            strokeDasharray="4 5"
          />
        </svg>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-center text-[11px] font-medium tracking-wide text-white/90">
          Cocokkan kepala ke oval · mata di garis kuning
        </div>
      </div>
    </div>
  );
}
