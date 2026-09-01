"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useNewPhotoSocket } from "@/hooks/useNewPhotoSocket";
import { usePhotoProcessedSocket } from "@/hooks/usePhotoProcessedSocket";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import {
  type PackageType,
  type Session,
  addTime,
  getKioskConfig,
  getPackageDurationMinutes,
  getSession,
  mainStart,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
  trialSkip,
  trialStart,
  triggerKioskCapture,
} from "@/services/session.service";
import {
  resolveAiGenerateLimit,
} from "@/lib/packageTypes";
import { fetchImages } from "@/services/image.service";
import type { GalleryImageData } from "@/lib/imageTypes";
import { RegisterWizard, getRegisterWizardContainerClass } from "@/components/kiosk/RegisterWizard";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { useSocketStatus } from "@/hooks/useSocketStatus";
import { ConnectionBanner } from "@/components/kiosk/ConnectionBanner";
import { SessionStepIndicator } from "@/components/kiosk/SessionStepIndicator";
import {
  SessionPreviewScreen,
  type SessionAction,
  type SessionMeta,
} from "@/components/kiosk/SessionPreviewScreen";

type Screen = "register" | "preview" | "end";

type Customer = {
  user: string;
  name: string;
  phone: string;
  peopleCount: number;
  templateId: string;
  packageType: PackageType;
  aiGenerateLimit?: number;
  aiThemeId?: string | null;
  aiThemeLabel?: string | null;
  aiThemePreviewUrl?: string | null;
  aiThemeType?: string | null;
};

const TRIAL_PRESETS = [30, 60, 90] as const;

function uniqueSessionImages(images: GalleryImageData[]) {
  const byKey = new Map<string, GalleryImageData>();
  for (const image of images) {
    byKey.set(image.imageId ?? image.filename, image);
  }
  return Array.from(byKey.values());
}

const DEFAULT_KIOSK_CONFIG = {
  sessionDurationMinutes: 10,
  captureCountdownSeconds: 3,
  trialDurationSeconds: 60,
  packageDurations: {
    "self-photo": 10,
    "ai-self-photo": 12,
  } as Record<PackageType, number>,
};

async function apiRegister(payload: {
  name: string;
  phone: string;
  peopleCount: number;
  templateId: string;
  packageType: PackageType;
  aiThemeId?: string;
}): Promise<Customer> {
  const res = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("register_failed");
  const data = (await res.json()) as { customer: Customer };
  return data.customer;
}

async function apiCustomerByName(name: string): Promise<Customer | null> {
  const res = await fetch(
    `${API_BASE_URL}/api/customer-by-name?name=${encodeURIComponent(name)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { customer: Customer };
  return data.customer ?? null;
}

function syncTimerFromSession(
  session: Session,
  syncFromServer: ReturnType<typeof useSessionTimer>["syncFromServer"]
) {
  syncFromServer({
    endsAt: session.endsAt,
    pausedAt: session.pausedAt,
    remainingMs:
      session.pausedAt != null
        ? (session.remainingMs ?? 0)
        : Math.max(0, session.endsAt - Date.now()),
  });
}

export function SessionKioskClient() {
  const router = useRouter();
  const { toast } = useToast();
  const [screen, setScreen] = React.useState<Screen>("register");
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [captureCountdown, setCaptureCountdown] = React.useState(3);
  const [session, setSession] = React.useState<Session | null>(null);
  const [sessionImages, setSessionImages] = React.useState<GalleryImageData[]>(
    []
  );
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);
  const [kioskConfig, setKioskConfig] = React.useState(DEFAULT_KIOSK_CONFIG);
  const [trialSeconds, setTrialSeconds] = React.useState(60);
  const [pendingAction, setPendingAction] = React.useState<SessionAction | null>(
    null
  );
  const [endedPackageType, setEndedPackageType] =
    React.useState<PackageType>("self-photo");
  const [sessionMeta, setSessionMeta] = React.useState<SessionMeta | null>(null);
  const [endedSessionUser, setEndedSessionUser] = React.useState<string | null>(
    null
  );
  const [endedSessionMeta, setEndedSessionMeta] = React.useState<SessionMeta | null>(
    null
  );

  const connected = useSocketStatus(true);
  const captureTimerRef = React.useRef<number | null>(null);
  const syncFromServerRef = React.useRef<
    ReturnType<typeof useSessionTimer>["syncFromServer"]
  >(() => {});

  const sessionRef = React.useRef(session);
  const sessionMetaRef = React.useRef(sessionMeta);
  sessionRef.current = session;
  sessionMetaRef.current = sessionMeta;
  const clearSessionTimerRef = React.useRef<() => void>(() => {});

  const finishSessionToEnd = React.useCallback(async () => {
    const s = sessionRef.current;
    const meta = sessionMetaRef.current;
    if (s?.packageType) setEndedPackageType(s.packageType as PackageType);
    if (s?.user) setEndedSessionUser(s.user);
    if (meta) setEndedSessionMeta(meta);
    await stopSession().catch(() => {});
    clearSessionTimerRef.current();
    setScreen("end");
    setSession(null);
    setSessionImages([]);
    setSelectedImageIndex(0);
  }, []);

  const sessionTimer = useSessionTimer({
    durationMs: kioskConfig.sessionDurationMinutes * 60 * 1000,
    onExpire: () => {
      void finishSessionToEnd();
    },
  });
  clearSessionTimerRef.current = sessionTimer.clear;

  React.useEffect(() => {
    syncFromServerRef.current = sessionTimer.syncFromServer;
  });

  React.useEffect(() => {
    getKioskConfig()
      .then((config) => {
        setKioskConfig({
          sessionDurationMinutes:
            config.sessionDurationMinutes ??
            DEFAULT_KIOSK_CONFIG.sessionDurationMinutes,
          captureCountdownSeconds:
            config.captureCountdownSeconds ??
            DEFAULT_KIOSK_CONFIG.captureCountdownSeconds,
          trialDurationSeconds:
            config.trialDurationSeconds ?? DEFAULT_KIOSK_CONFIG.trialDurationSeconds,
          packageDurations: {
            ...DEFAULT_KIOSK_CONFIG.packageDurations,
            ...config.packageDurations,
          },
        });
        const defaultTrial = config.trialDurationSeconds ?? 60;
        setTrialSeconds(
          TRIAL_PRESETS.includes(defaultTrial as (typeof TRIAL_PRESETS)[number])
            ? defaultTrial
            : 60
        );
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    return () => {
      if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    };
  }, []);

  const sessionImagesRef = React.useRef(sessionImages);
  const selectedImageIndexRef = React.useRef(selectedImageIndex);
  sessionImagesRef.current = sessionImages;
  selectedImageIndexRef.current = selectedImageIndex;

  const refreshSessionImages = React.useCallback(
    async (selectLatest = false) => {
      if (!session?.user) return;

      try {
        const res = await fetchImages(session.user);
        const next = uniqueSessionImages(res.images ?? []);
        const previous = sessionImagesRef.current;
        const previousKey =
          previous[selectedImageIndexRef.current]?.imageId ??
          previous[selectedImageIndexRef.current]?.filename;

        setSessionImages(next);

        if (next.length === 0) {
          setSelectedImageIndex(0);
          return;
        }

        if (selectLatest) {
          setSelectedImageIndex(next.length - 1);
          return;
        }

        const found = next.findIndex(
          (image) => (image.imageId ?? image.filename) === previousKey
        );
        setSelectedImageIndex(found >= 0 ? found : next.length - 1);
      } catch {
        // ignore transient fetch errors
      }
    },
    [session?.user]
  );

  React.useEffect(() => {
    if (screen !== "preview" || !session?.user) return;
    void refreshSessionImages(true);
    const poll = window.setInterval(() => {
      void refreshSessionImages(false);
    }, 4000);
    return () => window.clearInterval(poll);
  }, [refreshSessionImages, screen, session?.user]);

  useNewPhotoSocket({
    user: session?.user ?? "",
    enabled: screen === "preview" && Boolean(session?.user),
    onNewPhoto: () => {
      void refreshSessionImages(true);
    },
  });

  usePhotoProcessedSocket({
    user: session?.user ?? "",
    enabled: screen === "preview" && Boolean(session?.user),
    onPhotoProcessed: () => {
      void refreshSessionImages(false);
    },
  });

  React.useEffect(() => {
    if (screen !== "preview") return;

    async function pollSession() {
      try {
        const { activeSession, sessionLocked } = await getSession();
        if (sessionLocked || !activeSession) {
          sessionTimer.clear();
          setSession(null);
          setScreen("end");
          return;
        }

        setSession(activeSession);
        syncFromServerRef.current({
          endsAt: activeSession.endsAt,
          pausedAt: activeSession.pausedAt,
          remainingMs:
            activeSession.pausedAt != null
              ? (activeSession.remainingMs ?? 0)
              : Math.max(0, activeSession.endsAt - Date.now()),
        });
      } catch {
        // ignore transient poll errors
      }
    }

    void pollSession();
    const t = window.setInterval(() => void pollSession(), 8000);
    return () => window.clearInterval(t);
    // Poll interval only depends on screen; sync uses ref to avoid stale closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const handleCaptureDone = React.useCallback(async () => {
    window.setTimeout(() => {
      void refreshSessionImages(true);
    }, 1500);
  }, [refreshSessionImages]);

  const startCaptureCountdown = React.useCallback(() => {
    if (isCapturing || !session) return;

    const total = kioskConfig.captureCountdownSeconds || 3;
    setIsCapturing(true);
    setCaptureCountdown(total);
    let local = total;

    void triggerKioskCapture(session.user).catch(() => {
      // Operator countdown still runs if kiosk socket unreachable
    });

    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    captureTimerRef.current = window.setInterval(async () => {
      if (local <= 1) {
        if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
        await handleCaptureDone();
        setIsCapturing(false);
        return;
      }
      local -= 1;
      setCaptureCountdown(local);
    }, 1000);
  }, [handleCaptureDone, isCapturing, kioskConfig.captureCountdownSeconds, session]);

  const endSession = React.useCallback(async () => {
    await finishSessionToEnd();
  }, [finishSessionToEnd]);

  const beginPreview = React.useCallback(
    (s: Session) => {
      setSession(s);
      setSessionImages([]);
      setSelectedImageIndex(0);
      sessionTimer.startWithEndsAt(s.endsAt);
      setScreen("preview");
    },
    [sessionTimer]
  );

  const mainDurationMinutes = getPackageDurationMinutes(
    (session?.packageType ?? "self-photo") as PackageType,
    kioskConfig.packageDurations
  );

  React.useEffect(() => {
    if (screen !== "preview" || isCapturing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      event.preventDefault();
      startCaptureCountdown();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, isCapturing, startCaptureCountdown]);

  const runAction = React.useCallback(
    async (action: SessionAction, fn: () => Promise<void>) => {
      setPendingAction(action);
      try {
        await fn();
      } catch {
        toast("Aksi gagal. Coba lagi.", "error");
      } finally {
        setPendingAction(null);
      }
    },
    [toast]
  );

  if (screen === "register") {
    return (
      <RegisterOrCheckScreen
        connected={connected}
        packageDurations={kioskConfig.packageDurations}
        onRegister={async (name, phone, peopleCount, packageType, aiThemeId) => {
          const customer = await apiRegister({
            name,
            phone,
            peopleCount,
            templateId: "4R",
            packageType,
            aiThemeId,
          });
          const meta: SessionMeta = {
            peopleCount: customer.peopleCount,
            aiGenerateLimit:
              customer.aiGenerateLimit ??
              resolveAiGenerateLimit(packageType, peopleCount),
            aiThemeLabel: customer.aiThemeLabel ?? null,
            aiThemePreviewUrl: customer.aiThemePreviewUrl ?? null,
            aiThemeType:
              (customer.aiThemeType as SessionMeta["aiThemeType"]) ?? null,
          };
          setSessionMeta(meta);
          const s = await startSession({
            user: customer.user,
            peopleCount: customer.peopleCount,
            duration: getPackageDurationMinutes(
              packageType,
              kioskConfig.packageDurations
            ),
            packageType,
          });
          const quotaNote =
            packageType === "ai-self-photo"
              ? ` · kuota AI: ${customer.aiGenerateLimit ?? resolveAiGenerateLimit(packageType, peopleCount)}`
              : "";
          const themeNote =
            packageType === "ai-self-photo" && customer.aiThemeLabel
              ? ` · tema: ${customer.aiThemeLabel}`
              : "";
          toast(`Sesi dimulai untuk ${customer.name}${quotaNote}${themeNote}`, "success");
          beginPreview(s);
        }}
        onCheckByName={async (name) => {
          const customer = await apiCustomerByName(name);
          if (!customer) {
            toast("Nama tidak ditemukan untuk hari ini.", "error");
            return;
          }
          const packageType = (customer.packageType ?? "self-photo") as PackageType;
          const meta: SessionMeta = {
            peopleCount: customer.peopleCount,
            aiGenerateLimit:
              customer.aiGenerateLimit ??
              resolveAiGenerateLimit(packageType, customer.peopleCount),
            aiThemeLabel: customer.aiThemeLabel ?? null,
            aiThemePreviewUrl: customer.aiThemePreviewUrl ?? null,
            aiThemeType:
              (customer.aiThemeType as SessionMeta["aiThemeType"]) ?? null,
          };
          setSessionMeta(meta);
          const s = await startSession({
            user: customer.user,
            peopleCount: customer.peopleCount,
            duration: getPackageDurationMinutes(
              packageType,
              kioskConfig.packageDurations
            ),
            packageType,
          });
          toast(`Sesi dilanjutkan untuk ${customer.name}`, "success");
          beginPreview(s);
        }}
        onBack={() => router.push("/")}
        onError={(message) => toast(message, "error")}
      />
    );
  }

  if (screen === "preview") {
    return (
      <SessionPreviewScreen
        connected={connected}
        session={session}
        sessionMeta={sessionMeta}
        sessionTimer={{
          remainingMs: sessionTimer.remainingMs,
          isPaused: sessionTimer.isPaused,
        }}
        mainDurationMinutes={mainDurationMinutes}
        trialSeconds={trialSeconds}
        onTrialSecondsChange={setTrialSeconds}
        images={sessionImages}
        selectedImageIndex={selectedImageIndex}
        onSelectImage={setSelectedImageIndex}
        captureCountdown={captureCountdown}
        isCapturing={isCapturing}
        pendingAction={pendingAction}
        onBack={() => router.push("/")}
        onTrialStart={() =>
          runAction("trial", async () => {
            if (!session?.user) return;
            const data = await trialStart(session.user, trialSeconds);
            sessionTimer.startWithEndsAt(data.endsAt);
            toast("Trial dimulai", "success");
          })
        }
        onTrialSkip={() => {
          if (!session?.user) return;
          trialSkip(session.user).catch(() => {
            toast("Gagal skip trial", "error");
          });
        }}
        onMainStart={() =>
          runAction("main", async () => {
            if (!session?.user) return;
            const mainSeconds = mainDurationMinutes * 60;
            const data = await mainStart(
              session.user,
              mainSeconds,
              (session.packageType ?? "self-photo") as PackageType
            );
            sessionTimer.startWithEndsAt(data.endsAt);
            toast("Sesi utama dimulai", "success");
          })
        }
        onPause={() =>
          runAction("pause", async () => {
            await pauseSession();
            const { activeSession } = await getSession();
            if (activeSession) {
              syncTimerFromSession(activeSession, sessionTimer.syncFromServer);
            }
            toast("Sesi dijeda", "default");
          })
        }
        onResume={() =>
          runAction("resume", async () => {
            const resumed = await resumeSession();
            syncTimerFromSession(resumed, sessionTimer.syncFromServer);
            toast("Sesi dilanjutkan", "success");
          })
        }
        onAddTime={(minutes) =>
          runAction(minutes === 1 ? "add1" : "add5", async () => {
            await addTime(minutes);
            const { activeSession } = await getSession();
            if (activeSession) {
              syncTimerFromSession(activeSession, sessionTimer.syncFromServer);
            }
            toast(`+${minutes} menit ditambahkan`, "success");
          })
        }
        onEndSession={() => void runAction("end", endSession)}
      />
    );
  }

  return (
    <main className="flex min-h-[100dvh] w-full flex-col bg-black">
      <ConnectionBanner connected={connected} />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <SessionStepIndicator current="done" className="mb-8" />
        <h1 className="text-center text-3xl font-semibold tracking-wide text-white sm:text-5xl">
          Terima kasih
        </h1>
        <p className="mt-5 max-w-xl text-center text-sm text-white/60 sm:text-lg">
          Foto sudah tersimpan.{" "}
          {endedPackageType === "ai-self-photo" ? (
            <>
              Lanjut ke galeri untuk pilih foto dan generate AI
              {endedSessionMeta?.aiThemeLabel
                ? ` (${endedSessionMeta.aiThemeLabel})`
                : ""}
              {endedSessionMeta?.aiGenerateLimit
                ? ` · kuota ${endedSessionMeta.aiGenerateLimit}×`
                : ""}
              .
            </>
          ) : (
            "Customer bisa review dan cetak dari meja studio."
          )}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-10">
          {endedPackageType === "ai-self-photo" && endedSessionUser ? (
            <Button
              className="bg-violet-500 px-6 py-3 font-semibold text-white hover:bg-violet-400"
              onClick={() =>
                router.push(
                  `/gallery?user=${encodeURIComponent(endedSessionUser)}`
                )
              }
            >
              Buka Galeri AI
            </Button>
          ) : null}
          <Button
            className="bg-[#B59240] px-6 py-3 font-semibold text-black hover:bg-[#C9A855]"
            onClick={() => {
              sessionTimer.clear();
              setSession(null);
              setSessionMeta(null);
              setSessionImages([]);
              setSelectedImageIndex(0);
              setScreen("register");
            }}
          >
            Sesi baru
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={() => router.push("/")}
          >
            Ke beranda
          </Button>
        </div>
      </div>
    </main>
  );
}

type RegisterOrCheckScreenProps = {
  connected: boolean;
  packageDurations: Record<PackageType, number>;
  onRegister: (
    name: string,
    phone: string,
    peopleCount: number,
    packageType: PackageType,
    aiThemeId?: string
  ) => Promise<void>;
  onCheckByName: (name: string) => Promise<void>;
  onBack: () => void;
  onError: (message: string) => void;
};

function RegisterOrCheckScreen({
  connected,
  packageDurations,
  onRegister,
  onCheckByName,
  onBack,
  onError,
}: RegisterOrCheckScreenProps) {
  const [mode, setMode] = React.useState<"register" | "check">("register");
  const [checkName, setCheckName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [registerStep, setRegisterStep] = React.useState<1 | 2 | 3>(1);

  const registerContainerClass =
    mode === "register"
      ? getRegisterWizardContainerClass(registerStep)
      : "max-w-md";

  return (
    <main className="flex min-h-[100dvh] w-full flex-col bg-black">
      <ConnectionBanner connected={connected} />
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div
          className={cn(
            "w-full rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur transition-[max-width]",
            registerContainerClass
          )}
        >
          <SessionStepIndicator current="register" className="mb-6" />

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("register")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "register"
                  ? "bg-[#B59240]/25 text-[#E8C872] ring-1 ring-[#B59240]/40"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              Registrasi Baru
            </button>
            <button
              type="button"
              onClick={() => setMode("check")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                mode === "check"
                  ? "bg-[#B59240]/25 text-[#E8C872] ring-1 ring-[#B59240]/40"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              Cek Nama
            </button>
          </div>

          {mode === "register" ? (
            <RegisterWizard
              packageDurations={packageDurations}
              onBack={onBack}
              onError={onError}
              onStepChange={setRegisterStep}
              onSubmit={async (name, phone, peopleCount, packageType, aiThemeId) => {
                await onRegister(
                  name,
                  phone,
                  peopleCount,
                  packageType,
                  aiThemeId
                );
              }}
            />
          ) : null}

          {mode === "check" ? (
            <>
              <h2 className="text-lg font-semibold tracking-wide text-white sm:text-xl">
                Cek by Name
              </h2>
              <p className="mt-2 text-xs text-white/60 sm:text-sm">
                Lanjutkan sesi customer yang sudah terdaftar hari ini.
              </p>
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs tracking-[0.22em] text-white/60">NAMA</label>
                  <Input
                    value={checkName}
                    onChange={(e) => setCheckName(e.target.value)}
                    autoComplete="off"
                    className="h-11"
                    placeholder="Nama lengkap"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={onBack}
                  >
                    Kembali
                  </Button>
                  <Button
                    type="button"
                    className="h-11 flex-1 bg-[#B59240] font-semibold text-black hover:bg-[#C9A855]"
                    disabled={!checkName.trim() || submitting}
                    onClick={async () => {
                      if (!checkName.trim()) return;
                      setSubmitting(true);
                      try {
                        await onCheckByName(checkName.trim());
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {submitting ? "Mencari…" : "Cek & Mulai"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
