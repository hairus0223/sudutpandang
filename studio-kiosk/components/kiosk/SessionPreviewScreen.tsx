"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { msToMMSS } from "@/utils/time";
import type { Session } from "@/services/session.service";
import { ConnectionBanner } from "@/components/kiosk/ConnectionBanner";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  Lock,
  Maximize2,
  Pause,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { getPackageLabel, resolveAiGenerateLimit } from "@/lib/packageTypes";
import { getProcessingStatusLabel } from "@/lib/processingLabels";
import { getOriginalPreviewUrl } from "@/lib/aiGalleryUtils";
import type { GalleryImageData, PackageType, AiThemeType } from "@/lib/imageTypes";
import { SessionPhotoViewer } from "@/components/kiosk/SessionPhotoViewer";

const TRIAL_PRESETS = [30, 60, 90] as const;

export type SessionAction =
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
  images: GalleryImageData[];
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  captureCountdown: number;
  isCapturing: boolean;
  pendingAction: SessionAction | null;
  onBack: () => void;
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
  images,
  selectedImageIndex,
  onSelectImage,
  captureCountdown,
  isCapturing,
  pendingAction,
  onBack,
  onTrialStart,
  onTrialSkip,
  onMainStart,
  onPause,
  onResume,
  onAddTime,
  onEndSession,
}: SessionPreviewScreenProps) {
  const [controlsOpen, setControlsOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const timerWarn = sessionTimer.remainingMs <= 60_000 && !sessionTimer.isPaused;
  const phase = phaseLabel(session?.phase, sessionTimer.isPaused);
  const packageType = (session?.packageType ?? "self-photo") as PackageType;
  const isAiPackage = packageType === "ai-self-photo";
  const aiQuota =
    sessionMeta?.aiGenerateLimit ??
    resolveAiGenerateLimit(
      packageType,
      sessionMeta?.peopleCount ?? session?.peopleCount ?? 1
    );
  const selectedImage = images[selectedImageIndex] ?? null;
  const selectedUrl = selectedImage ? getOriginalPreviewUrl(selectedImage) : null;
  const lastImageProcessing =
    selectedImage?.processingStatus === "pending" ||
    selectedImage?.processingStatus === "processing";
  const filmstripRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = filmstripRef.current?.querySelector("[data-active-thumb]");
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [selectedImageIndex]);

  return (
    <main className="flex h-[100dvh] w-full flex-col overflow-hidden bg-black">
      <ConnectionBanner connected={connected} />

      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-1 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Kembali</span>
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-mono text-2xl tabular-nums leading-none tracking-tight sm:text-3xl",
              timerWarn ? "text-amber-300" : "text-white"
            )}
          >
            {msToMMSS(sessionTimer.remainingMs)}
          </p>
          <p className="mt-1 truncate text-[11px] text-white/50">
            {phase} · {session?.user ?? "-"} · {images.length} foto
            {isAiPackage && sessionMeta?.aiThemeLabel
              ? ` · ${sessionMeta.aiThemeLabel}`
              : ""}
          </p>
        </div>

        <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/75">
            {getPackageLabel(packageType)}
          </span>
          {isAiPackage && aiQuota > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-200">
              <Sparkles className="size-3" />
              {aiQuota}×
            </span>
          ) : null}
        </div>
      </header>

      <section className="relative min-h-0 flex-1 bg-black">
        {selectedUrl ? (
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="absolute inset-0"
            aria-label="Lihat detail foto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedUrl}
              alt={selectedImage?.filename ?? "Snapshot sesi"}
              className="size-full object-contain"
            />
            {lastImageProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                <span className="rounded-full bg-amber-500/90 px-4 py-2 text-sm text-white">
                  {getProcessingStatusLabel(selectedImage?.processingStatus) ??
                    "Memproses foto…"}
                </span>
              </div>
            )}
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-sm">
              <Maximize2 className="size-3.5" />
              Detail
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white/55">
            <Camera className="size-12 text-white/25" strokeWidth={1.25} />
            <p className="max-w-sm text-sm leading-relaxed sm:text-base">
              Snapshot akan tampil di sini setelah customer mengambil foto di
              kiosk. Riwayat foto sesi muncul di bawah.
            </p>
          </div>
        )}

        {isCapturing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <div className="text-6xl font-extrabold tracking-[0.18em] text-white sm:text-8xl">
              {captureCountdown}
            </div>
          </div>
        )}

        {isAiPackage && sessionMeta?.aiThemeLabel ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-black/60 px-2.5 py-1 text-[11px] text-violet-100 backdrop-blur-sm sm:left-4 sm:top-4">
            <Lock className="size-3" />
            {sessionMeta.aiThemeLabel}
          </div>
        ) : null}
      </section>

      {images.length > 0 ? (
        <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a] px-3 py-2 sm:px-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Riwayat foto · {images.length}
            </p>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="text-[11px] text-[#E8C872] hover:text-[#f0d48a]"
            >
              Buka detail
            </button>
          </div>
          <div
            ref={filmstripRef}
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {images.map((image, index) => {
              const active = index === selectedImageIndex;
              const thumb = getOriginalPreviewUrl(image);

              return (
                <button
                  key={image.imageId ?? image.filename}
                  type="button"
                  data-active-thumb={active ? "" : undefined}
                  onClick={() => onSelectImage(index)}
                  onDoubleClick={() => {
                    onSelectImage(index);
                    setDetailOpen(true);
                  }}
                  className={cn(
                    "relative h-16 w-12 shrink-0 overflow-hidden rounded-md ring-1 transition sm:h-[4.5rem] sm:w-14",
                    active
                      ? "ring-2 ring-[#E8C872]"
                      : "ring-white/15 hover:ring-white/40"
                  )}
                  aria-label={`Foto ${index + 1}`}
                  aria-current={active ? "true" : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb}
                    alt=""
                    className="size-full object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] text-white/80">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <SessionPhotoViewer
        open={detailOpen}
        images={images}
        index={selectedImageIndex}
        onClose={() => setDetailOpen(false)}
        onChange={onSelectImage}
      />

      <footer className="relative z-20 shrink-0 border-t border-white/10 bg-[#0a0a0a] pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-expanded={controlsOpen}
          onClick={() => setControlsOpen((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left sm:px-5"
        >
          <span className="text-sm font-medium text-white">Kontrol sesi</span>
          <span className="hidden text-xs text-white/40 sm:inline">
            {controlsOpen
              ? "Tutup untuk lihat foto lebih besar"
              : "Buka untuk atur sesi"}
          </span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-white/55 transition-transform duration-200",
              controlsOpen && "rotate-180"
            )}
          />
        </button>

        {controlsOpen ? (
          <div className="max-h-[min(42vh,22rem)] overflow-y-auto border-t border-white/8 px-3 py-3 sm:px-5">
            {session ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <select
                    value={trialSeconds}
                    onChange={(e) =>
                      onTrialSecondsChange(Number(e.target.value))
                    }
                    className="h-11 rounded-md border border-white/15 bg-white/5 px-2 text-sm text-white"
                  >
                    {TRIAL_PRESETS.map((seconds) => (
                      <option
                        key={seconds}
                        value={seconds}
                        className="text-black"
                      >
                        Trial {seconds} detik
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={pendingAction === "trial"}
                    onClick={() => void onTrialStart()}
                  >
                    {pendingAction === "trial" ? "…" : "Mulai trial"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={onTrialSkip}
                  >
                    Lewati trial
                  </Button>
                  <Button
                    type="button"
                    className="h-11 bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
                    disabled={pendingAction === "main"}
                    onClick={() => void onMainStart()}
                  >
                    {pendingAction === "main"
                      ? "…"
                      : `Sesi utama (${mainDurationMinutes} mnt)`}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={sessionTimer.isPaused || pendingAction === "pause"}
                    onClick={() => void onPause()}
                  >
                    <Pause className="size-4" />
                    Jeda
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={!sessionTimer.isPaused || pendingAction === "resume"}
                    onClick={() => void onResume()}
                  >
                    <Play className="size-4" />
                    Lanjut
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={pendingAction === "add1"}
                    onClick={() => void onAddTime(1)}
                  >
                    <Plus className="size-4" />
                    1 menit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={pendingAction === "add5"}
                    onClick={() => void onAddTime(5)}
                  >
                    <Plus className="size-4" />
                    5 menit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="col-span-2 h-11 sm:col-span-1"
                    disabled={pendingAction === "end"}
                    onClick={onEndSession}
                  >
                    Akhiri sesi
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full sm:w-auto"
                disabled={pendingAction === "end"}
                onClick={onEndSession}
              >
                Akhiri sesi
              </Button>
            )}
          </div>
        ) : null}
      </footer>
    </main>
  );
}
