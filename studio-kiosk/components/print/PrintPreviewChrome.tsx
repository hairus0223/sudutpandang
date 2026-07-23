"use client";

import type { ReactNode } from "react";
import { RotateCcw, Move, MousePointer2, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrintPreviewChrome({
  pageLabel,
  activeLabel,
  hint,
  onReset,
  showControls = true,
  compact = false,
  children,
  className,
}: {
  pageLabel?: string;
  activeLabel?: string | null;
  hint?: string;
  onReset?: () => void;
  showControls?: boolean;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[min(100%,920px)] flex-col items-center gap-3",
        className
      )}
    >
      {showControls && (pageLabel || activeLabel) ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1">
          {pageLabel ? (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/55">
              {pageLabel}
            </span>
          ) : (
            <span />
          )}
          {activeLabel ? (
            <span className="max-w-[min(100%,280px)] truncate text-[11px] text-violet-300/90">
              {activeLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "relative w-full rounded-2xl border border-white/10 shadow-2xl",
          compact ? "p-2 sm:p-3" : "p-3 sm:p-4"
        )}
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04) 25%, transparent 25%) 0 0 / 16px 16px, linear-gradient(225deg, rgba(255,255,255,0.04) 25%, transparent 25%) 0 0 / 16px 16px, radial-gradient(circle at 50% 0%, rgba(139,92,246,0.12), transparent 55%), #171717",
        }}
      >
        <div className="flex justify-center">{children}</div>
      </div>

      {showControls && !compact ? (
        <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 px-1">
          <PreviewHint icon={<MousePointer2 className="h-3 w-3" />} text="Klik untuk pilih" />
          <PreviewHint icon={<ZoomIn className="h-3 w-3" />} text="Scroll / pinch zoom" />
          <PreviewHint icon={<Move className="h-3 w-3" />} text="Drag untuk geser" />
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              Reset posisi
            </button>
          ) : null}
        </div>
      ) : null}

      {showControls && !compact && hint ? (
        <p className="max-w-md text-center text-[11px] leading-relaxed text-white/40">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PreviewHint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-white/45">
      {icon}
      {text}
    </span>
  );
}
