import { cn } from "@/lib/utils";

/* ─── Design tokens: outline-first, high contrast on dark UI ─── */

const btnBase =
  "inline-flex items-center justify-center gap-2.5 rounded-xl border-2 px-5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const btnSm =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98]";

/** Sticky action panel */
export const galleryPanelClass =
  "rounded-2xl border-2 border-white/10 bg-[#0f0f12]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-5";

export const galleryBtnRowClass = "flex flex-wrap items-center gap-3";

/* ─── Action buttons ─── */

export function btnPrimary(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-violet-300 bg-violet-500/20 text-violet-50 shadow-sm shadow-violet-950/50"
      : "border-violet-400 bg-transparent text-violet-200 hover:border-violet-300 hover:bg-violet-500/12 hover:text-violet-100",
    className
  );
}

export function btnPrint(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-[#E8C872] bg-[#E8C872]/15 text-[#F5DCA8] shadow-sm shadow-black/30"
      : "border-[#E8C872]/70 bg-transparent text-[#E8C872] hover:border-[#E8C872] hover:bg-[#E8C872]/10",
    className
  );
}

export function btnAi(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-violet-300 bg-violet-500/20 text-violet-50"
      : "border-violet-400/70 bg-transparent text-violet-200 hover:border-violet-300 hover:bg-violet-500/12",
    className
  );
}

export function btnSuccess(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-emerald-300 bg-emerald-500/20 text-emerald-50"
      : "border-emerald-400/80 bg-transparent text-emerald-300 hover:border-emerald-300 hover:bg-emerald-500/12 hover:text-emerald-200",
    className
  );
}

export function btnNeutral(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-white/50 bg-white/12 text-white"
      : "border-white/35 bg-transparent text-white/90 hover:border-white/50 hover:bg-white/8 hover:text-white",
    className
  );
}

export function btnDanger(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-red-300 bg-red-500/20 text-red-50"
      : "border-red-400/70 bg-transparent text-red-300 hover:border-red-300 hover:bg-red-500/12",
    className
  );
}

export function btnWarning(active = false, className?: string) {
  return cn(
    btnBase,
    active
      ? "border-amber-300 bg-amber-500/20 text-amber-50"
      : "border-amber-400/80 bg-transparent text-amber-200 hover:border-amber-300 hover:bg-amber-500/12",
    className
  );
}

export function btnGhost(className?: string) {
  return cn(
    btnSm,
    "border-white/20 bg-transparent text-white/65 hover:border-white/35 hover:bg-white/6 hover:text-white/90",
    className
  );
}

/* ─── Icon / tile controls ─── */

export function btnIcon(className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl border-2 border-white/40 bg-black/50 p-2.5 text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-white/10 active:scale-95",
    className
  );
}

export function btnIconSm(className?: string) {
  return cn(
    "inline-flex size-10 items-center justify-center rounded-xl border-2 border-white/35 bg-black/55 text-white backdrop-blur-sm transition hover:border-violet-400/70 hover:bg-violet-500/15 hover:text-violet-100 active:scale-95",
    className
  );
}

export function btnSelect(
  active: boolean,
  accent: "violet" | "gold" = "violet",
  className?: string
) {
  if (active) {
    return cn(
      "absolute left-3 top-3 z-30 flex size-9 items-center justify-center rounded-xl border-2 backdrop-blur-sm transition active:scale-95",
      accent === "violet"
        ? "border-violet-300 bg-violet-500/25 text-violet-50 shadow-sm shadow-violet-950/40"
        : "border-[#E8C872] bg-[#E8C872]/15 text-[#F5DCA8] shadow-sm",
      className
    );
  }
  return cn(
    "absolute left-3 top-3 z-30 flex size-9 items-center justify-center rounded-xl border-2 border-white/35 bg-black/55 text-white backdrop-blur-sm transition hover:border-white/55 hover:bg-black/70 active:scale-95",
    className
  );
}

export function badgePrintOutline(
  variant: "original" | "ai",
  className?: string
) {
  return cn(
    btnSm,
    "absolute right-3 top-3 z-20 gap-1 px-2.5 py-1 text-[10px] backdrop-blur-sm",
    variant === "ai"
      ? "border-violet-400/80 text-violet-100 hover:border-violet-300 hover:bg-violet-500/15"
      : "border-[#E8C872]/80 text-[#E8C872] hover:border-[#E8C872] hover:bg-[#E8C872]/10",
    className
  );
}

/* ─── Chips & segments ─── */

export function toggleChipClass(
  active: boolean,
  variant: "original" | "ai" = "original"
) {
  if (!active) {
    return cn(
      btnSm,
      "border-white/25 bg-transparent text-white/70 hover:border-white/40 hover:bg-white/6 hover:text-white/90"
    );
  }
  return variant === "ai" ? btnAi(true) : btnPrint(true);
}

export function btnSegment(
  active: boolean,
  variant: "original" | "ai" = "original",
  className?: string
) {
  return cn(
    "flex-1 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition",
    active
      ? variant === "ai"
        ? "border-violet-300 bg-violet-500/20 text-violet-50"
        : "border-white/50 bg-white/10 text-white"
      : "border-transparent bg-transparent text-white/55 hover:text-white/85",
    className
  );
}

/* ─── Back-compat aliases ─── */

export const actionBtnPrimary = (className?: string) => btnPrimary(false, className);
export const actionBtnPrintActive = (className?: string) => btnPrint(true, className);
export const actionBtnPrint = (className?: string) => btnPrint(false, className);
export const actionBtnAiSoft = (className?: string) => btnAi(false, className);
export const actionBtnSecondary = (className?: string) => btnNeutral(false, className);
export const actionBtnGhost = (className?: string) => btnGhost(className);
export const modalActionBtnClass = btnNeutral(false);
