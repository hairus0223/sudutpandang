"use client";

import { cn } from "@/lib/utils";

export type SessionStep = "register" | "session" | "done";

const STEPS: { id: SessionStep; label: string }[] = [
  { id: "register", label: "Registrasi" },
  { id: "session", label: "Sesi" },
  { id: "done", label: "Selesai" },
];

type SessionStepIndicatorProps = {
  current: SessionStep;
  className?: string;
};

export function SessionStepIndicator({
  current,
  className,
}: SessionStepIndicatorProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <nav
      aria-label="Langkah sesi"
      className={cn("flex items-center justify-center gap-2 sm:gap-4", className)}
    >
      {STEPS.map((step, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;

        return (
          <div key={step.id} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition",
                  isActive &&
                    "border-[#B59240] bg-[#B59240]/20 text-[#E8C872]",
                  isComplete &&
                    "border-emerald-500/50 bg-emerald-500/15 text-emerald-200",
                  !isActive &&
                    !isComplete &&
                    "border-white/15 bg-white/5 text-white/40"
                )}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[10px] uppercase tracking-[0.18em] sm:block",
                  isActive ? "text-[#E8C872]" : "text-white/45"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px w-6 sm:w-10",
                  index < currentIndex ? "bg-emerald-500/40" : "bg-white/10"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
