"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { msToMMSS } from "@/utils/time";
import type { Session } from "@/services/session.service";
import { ConnectionBanner } from "@/components/kiosk/ConnectionBanner";
import { SessionStepIndicator } from "@/components/kiosk/SessionStepIndicator";
import { ArrowLeft, Camera, ChevronDown, Sparkles, Lock } from "lucide-react";
import { getPackageLabel, resolveAiGenerateLimit } from "@/lib/packageTypes";
import { getProcessingStatusLabel } from "@/lib/processingLabels";
import type { PackageType, AiThemeType } from "@/lib/imageTypes";

const TRIAL_PRESETS = [30, 60, 90] as const;

export type SessionAction =
  | "capture"
  | "trial"
  | "main"
  | "pause"
  | "resume"
  | "add1"
  | "add5"
  | "end";

export type SessionMeta = {
  peopleCount: number;
  aiGenerateLimit: number;
  aiThemeLabel: string | null;
  aiThemePreviewUrl?: string | null;
  aiThemeType?: AiThemeType | null;
};

type SessionPreviewScreenProps = {
  connected: boolean;
  session: Session | null;
  sessionMeta: SessionMeta | null;
  sessionTimer: {
    remainingMs: number;
    isPaused: boolean;
  };
  mainDurationMinutes: number;
  trialSeconds: number;
  onTrialSecondsChange: (seconds: number) => void;
  captureCount: number;
  captureCountdown: number;
  isCapturing: boolean;
  lastImageUrl: string | null;
  lastImageProcessing: boolean;
  pendingAction: SessionAction | null;
  onBack: () => void;
  onCapture: () => void;
  onTrialStart: () => Promise<void>;
  onTrialSkip: () => void;
  onMainStart: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onAddTime: (minutes: number) => Promise<void>;
  onEndSession: () => void;
};

function phaseLabel(phase?: string | null, isPaused?: boolean) {
  if (isPaused) return "Jeda";
  if (phase === "trial") return "Trial";
  if (phase === "main") return "Sesi utama";
  return "Siap";
}

export function SessionPreviewScreen({
  connected,
  session,
  sessionMeta,
  sessionTimer,
  mainDurationMinutes,
  trialSeconds,
  onTrialSecondsChange,
  captureCount,
  captureCountdown,
  isCapturing,
  lastImageUrl,
  lastImageProcessing,
  pendingAction,
  onBack,
  onCapture,
  onTrialStart,
  onTrialSkip,
  onMainStart,
  onPause,
  onResume,
  onAddTime,
  onEndSession,
}: SessionPreviewScreenProps) {
  const timerWarn = sessionTimer.remainingMs <= 60_000 && !sessionTimer.isPaused;
  const phase = phaseLabel(session?.phase, sessionTimer.isPaused);
  const packageType = (session?.packageType ?? "self-photo") as PackageType;
  const isAiPackage = packageType === "ai-self-photo";
  const aiQuota =
    sessionMeta?.aiGenerateLimit ??
    resolveAiGenerateLimit(packageType, sessionMeta?.peopleCount ?? session?.peopleCount ?? 1);

  return (
    <main className="flex h-[100dvh] w-full flex-col bg-black">
      <ConnectionBanner connected={connected} />

      <header className="flex shrink-0 flex-col gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Kembali
          </button>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70">
            {session?.user ?? "-"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/75">
            {getPackageLabel(packageType)}
          </span>
          {isAiPackage && sessionMeta?.aiThemeLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-200">
              {sessionMeta.aiThemePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sessionMeta.aiThemePreviewUrl}
                  alt=""
                  className="h-5 w-4 rounded object-cover ring-1 ring-white/15"
                />
              ) : (
                <Sparkles className="size-3" />
              )}
              {sessionMeta.aiThemeLabel}
            </span>
          ) : null}
          {isAiPackage && aiQuota > 0 ? (
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-200/90">
              Kuota AI: {aiQuota}×
            </span>
          ) : null}
        </div>
        <SessionStepIndicator current="session" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex shrink-0 flex-col items-center gap-3 border-b border-white/10 px-4 py-4 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
              Waktu tersisa
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-4xl tabular-nums tracking-tight sm:text-5xl",
                timerWarn ? "text-amber-300" : "text-white"
              )}
            >
              {msToMMSS(sessionTimer.remainingMs)}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {phase} · {getPackageLabel(packageType)} · {captureCount} foto
            </p>
            {isAiPackage && sessionMeta?.aiThemeLabel ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-violet-300/80">
                <Lock className="size-3" />
                Tema sesi: {sessionMeta.aiThemeLabel}
                {sessionMeta.aiThemeType === "transform" ? " · Transform" : " · Latar"}
              </p>
            ) : null}
          </div>

          {isAiPackage && sessionMeta?.aiThemePreviewUrl ? (
            <div className="hidden w-full max-w-[200px] overflow-hidden rounded-lg border border-violet-400/25 bg-violet-500/10 lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sessionMeta.aiThemePreviewUrl}
                alt={sessionMeta.aiThemeLabel ?? "Preview tema"}
                className="aspect-[3/4] w-full object-cover"
              />
              <p className="px-2 py-1.5 text-center text-[10px] text-violet-200/80">
                Contoh hasil AI
              </p>
            </div>
          ) : null}

          {lastImageUrl && (
            <div className="relative hidden w-full max-w-[200px] overflow-hidden rounded-lg border border-white/15 lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lastImageUrl}
                alt="Foto terakhir"
                className="aspect-[3/4] w-full object-cover"
              />
              {lastImageProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">
                  Memproses…
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
          {lastImageUrl ? (
            <div className="relative h-full w-full max-h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lastImageUrl}
                alt="Preview foto terakhir"
                className="mx-auto h-full max-h-[min(70vh,900px)] w-full object-contain"
              />
              {lastImageProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <span className="rounded-full bg-amber-500/90 px-4 py-2 text-sm text-white">
                    {getProcessingStatusLabel("processing") ?? "Memproses foto…"}
                  </span>
                </div>
              )}
              {isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="text-6xl font-extrabold tracking-[0.18em] text-white sm:text-8xl">
                    {captureCountdown}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex max-w-md flex-col items-center gap-4 text-center text-white/50">
              <Camera className="size-12 text-white/25" strokeWidth={1.25} />
              <p className="text-sm sm:text-base">
                Belum ada foto. Tekan <strong className="text-[#E8C872]">Ambil Foto</strong> untuk
                memulai capture ke kiosk customer.
              </p>
              {isCapturing && (
                <div className="text-6xl font-extrabold tracking-[0.18em] text-white sm:text-8xl">
                  {captureCountdown}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-black/95 px-3 py-3 sm:px-4 sm:py-4">
        <Button
          type="button"
          className="h-12 w-full bg-[#B59240] text-base font-semibold text-black hover:bg-[#C9A855]"
          onClick={onCapture}
          disabled={isCapturing || pendingAction === "capture"}
        >
          {pendingAction === "capture" || isCapturing
            ? "Menghitung mundur…"
            : "Ambil Foto"}
        </Button>

        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 py-2 text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white/70">
            Kontrol sesi
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </summary>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {session && (
              <>
                <select
                  value={trialSeconds}
                  onChange={(e) => onTrialSecondsChange(Number(e.target.value))}
                  className="col-span-2 h-11 rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white sm:col-span-1"
                >
                  {TRIAL_PRESETS.map((seconds) => (
                    <option key={seconds} value={seconds} className="text-black">
                      Trial {seconds}s
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  disabled={pendingAction === "trial"}
                  onClick={() => void onTrialStart()}
                >
                  {pendingAction === "trial" ? "…" : "Start Trial"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  onClick={onTrialSkip}
                >
                  Skip Trial
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="col-span-2 h-11 border-white/20 bg-white/5 text-white hover:bg-white/10 sm:col-span-1"
                  disabled={pendingAction === "main"}
                  onClick={() => void onMainStart()}
                >
                  {pendingAction === "main"
                    ? "…"
                    : `Sesi utama (${mainDurationMinutes}m)`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  disabled={sessionTimer.isPaused || pendingAction === "pause"}
                  onClick={() => void onPause()}
                >
                  Pause
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  disabled={!sessionTimer.isPaused || pendingAction === "resume"}
                  onClick={() => void onResume()}
                >
                  Resume
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  disabled={pendingAction === "add1"}
                  onClick={() => void onAddTime(1)}
                >
                  +1 min
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  disabled={pendingAction === "add5"}
                  onClick={() => void onAddTime(5)}
                >
                  +5 min
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="destructive"
              className="col-span-2 h-11 sm:col-span-1"
              disabled={pendingAction === "end"}
              onClick={onEndSession}
            >
              Akhiri Sesi
            </Button>
          </div>
        </details>
      </footer>
    </main>
  );
}
