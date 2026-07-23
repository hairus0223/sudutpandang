"use client";

import { Check, Images, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pilih + generate dalam satu langkah, lalu hasil & cetak. */
export type AiWizardStep = "compose" | "results";

const STEPS: {
  id: AiWizardStep;
  label: string;
  icon: typeof Images;
}[] = [
  { id: "compose", label: "Pilih & Generate", icon: Wand2 },
  { id: "results", label: "Hasil & Cetak", icon: Sparkles },
];

type AiWizardStepperProps = {
  step: AiWizardStep;
  onStepChange: (step: AiWizardStep) => void;
  readyCount: number;
  aiSlotsUsed: number;
  aiGenerateLimit: number;
  quotaExhausted: boolean;
};

export function AiWizardStepper({
  step,
  onStepChange,
  readyCount,
  aiSlotsUsed,
  aiGenerateLimit,
  quotaExhausted,
}: AiWizardStepperProps) {
  const activeIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <nav
      className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-3 sm:p-4"
      aria-label="Langkah AI Self Photo"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
          {STEPS.map((entry, index) => {
            const Icon = entry.icon;
            const isActive = entry.id === step;
            const isComplete =
              index < activeIndex ||
              (entry.id === "results" && readyCount > 0 && !isActive);
            const isLast = index === STEPS.length - 1;

            return (
              <li key={entry.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onStepChange(entry.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-2.5 py-1.5 text-left transition sm:px-3",
                    isActive
                      ? "bg-violet-500 text-white shadow-lg shadow-violet-900/30"
                      : isComplete
                        ? "text-violet-200 hover:bg-white/5"
                        : "text-white/55 hover:bg-white/5 hover:text-white/80"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      isActive
                        ? "border-white/30 bg-white/15"
                        : isComplete
                          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                          : "border-white/15 bg-white/5"
                    )}
                  >
                    {isComplete && !isActive ? (
                      <Check className="size-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="hidden min-w-0 sm:inline">
                    <span className="block text-xs font-medium">{entry.label}</span>
                  </span>
                  <Icon className="size-4 sm:hidden" aria-hidden />
                </button>
                {!isLast ? (
                  <div
                    className={cn(
                      "mx-1 hidden h-px w-8 sm:block md:w-14",
                      index < activeIndex ? "bg-violet-400/50" : "bg-white/10"
                    )}
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span className="rounded-full bg-white/5 px-2.5 py-1">
            Slot AI: {aiSlotsUsed}/{aiGenerateLimit}
          </span>
          {readyCount > 0 ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-200">
              {readyCount} hasil siap
            </span>
          ) : null}
          {quotaExhausted ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-200">
              Kuota habis
            </span>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
