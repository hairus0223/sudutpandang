"use client";

import { PASSPORT_BUST_PATH } from "@/lib/passportPose";
import { cn } from "@/lib/utils";

type PassportGuideOverlayProps = {
  color?: string | null;
  visible?: boolean;
  compact?: boolean;
};

export function PassportGuideOverlay({
  color = "#438CCB",
  visible = true,
  compact = false,
}: PassportGuideOverlayProps) {
  if (!visible) return null;
  const frameStroke = color || "#438CCB";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"
      aria-hidden
    >
      <div
        className={cn(
          "relative",
          compact ? "h-[72%] max-h-[420px]" : "h-[78%] max-h-[560px]"
        )}
        style={{ aspectRatio: "3 / 4" }}
      >
        <div
          className="absolute inset-0 rounded-[10px] shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
          style={{ border: `4px solid ${frameStroke}` }}
        />
        <svg viewBox="0 0 300 400" className="absolute inset-0 size-full">
          <defs>
            <linearGradient id="passportBustFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e8c4a8" stopOpacity="0.42" />
              <stop offset="55%" stopColor="#c9956c" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#8a5a3c" stopOpacity="0.14" />
            </linearGradient>
          </defs>
          <path
            d={`M0 0 H300 V400 H0 Z ${PASSPORT_BUST_PATH}`}
            fillRule="evenodd"
            fill="rgba(0,0,0,0.45)"
          />
          <path d={PASSPORT_BUST_PATH} fill="url(#passportBustFill)" />
          <path
            d={PASSPORT_BUST_PATH}
            fill="none"
            stroke="#22c55e"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          <line
            x1="48"
            y1="138"
            x2="252"
            y2="138"
            stroke="rgba(232,200,114,0.92)"
            strokeWidth="2.2"
            strokeDasharray="6 5"
          />
        </svg>
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-400" />
            Hijau = tepat
          </span>
          <span className="text-white/35">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" />
            Merah = geser
          </span>
        </div>
      </div>
    </div>
  );
}
