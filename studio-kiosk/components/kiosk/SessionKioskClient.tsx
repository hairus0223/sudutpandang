"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/env";
import { cn } from "@/lib/utils";
import { msToMMSS } from "@/utils/time";
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
} from "@/services/session.service";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Screen = "register" | "preview" | "end";

type Customer = {
  user: string;
  name: string;
  phone: string;
  peopleCount: number;
  templateId: string;
  packageType?: PackageType;
};

const TRIAL_PRESETS = [30, 60, 90] as const;

const DEFAULT_KIOSK_CONFIG = {
  sessionDurationMinutes: 10,
  captureCountdownSeconds: 3,
  trialDurationSeconds: 60,
  packageDurations: {
    "self-photo": 10,
    "pas-photo": 5,
    "ai-photo": 10,
  } as Record<PackageType, number>,
};

async function apiRegister(payload: {
  name: string;
  phone: string;
  peopleCount: number;
  templateId: string;
  packageType: PackageType;
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

async function apiLatestImageUrl(userSlug: string): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/api/images/${encodeURIComponent(userSlug)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { images: Array<{ url: string }> };
  if (!Array.isArray(data.images) || data.images.length === 0) return null;
  return data.images[data.images.length - 1]?.url ?? null;
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
  const [screen, setScreen] = React.useState<Screen>("register");
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [captureCountdown, setCaptureCountdown] = React.useState(3);
  const [captureCount, setCaptureCount] = React.useState(0);
  const [session, setSession] = React.useState<Session | null>(null);
  const [lastImageUrl, setLastImageUrl] = React.useState<string | null>(null);
  const [kioskConfig, setKioskConfig] = React.useState(DEFAULT_KIOSK_CONFIG);
  const [trialSeconds, setTrialSeconds] = React.useState(60);

  const captureTimerRef = React.useRef<number | null>(null);
  const syncFromServerRef = React.useRef<
    ReturnType<typeof useSessionTimer>["syncFromServer"]
  >(() => {});

  const sessionTimer = useSessionTimer({
    durationMs: kioskConfig.sessionDurationMinutes * 60 * 1000,
    onExpire: () => {
      void stopSession().catch(() => {});
      setScreen("end");
      setSession(null);
      setLastImageUrl(null);
    },
  });

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

  const refreshLastImage = React.useCallback(async () => {
    if (!session?.user) return;
    const url = await apiLatestImageUrl(session.user);
    if (url) setLastImageUrl(url);
  }, [session?.user]);

  React.useEffect(() => {
    if (screen !== "preview" || !session?.user) return;
    refreshLastImage();
    const t = window.setInterval(() => refreshLastImage(), 2000);
    return () => window.clearInterval(t);
  }, [refreshLastImage, screen, session?.user]);

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

  const handleCapture = React.useCallback(async () => {
    setCaptureCount((c) => c + 1);
    window.setTimeout(() => {
      refreshLastImage();
    }, 1500);
  }, [refreshLastImage]);

  const startCaptureCountdown = React.useCallback(() => {
    if (isCapturing || !session) return;
    setIsCapturing(true);
    setCaptureCountdown(3);
    let local = 3;

    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    captureTimerRef.current = window.setInterval(async () => {
      if (local <= 1) {
        if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
        await handleCapture();
        setIsCapturing(false);
        return;
      }
      local -= 1;
      setCaptureCountdown(local);
    }, 1000);
  }, [handleCapture, isCapturing, session]);

  const endSession = React.useCallback(async () => {
    await stopSession().catch(() => {});
    sessionTimer.clear();
    setScreen("end");
    setSession(null);
    setLastImageUrl(null);
  }, [sessionTimer]);

  const beginPreview = React.useCallback(
    (s: Session) => {
      setSession(s);
      setCaptureCount(0);
      setLastImageUrl(null);
      sessionTimer.startWithEndsAt(s.endsAt);
      setScreen("preview");
    },
    [sessionTimer]
  );

  const mainDurationMinutes = session
    ? getPackageDurationMinutes(
        session.packageType || "self-photo",
        kioskConfig.packageDurations
      )
    : kioskConfig.sessionDurationMinutes;

  if (screen === "register") {
    return (
      <RegisterOrCheckScreen
        packageDurations={kioskConfig.packageDurations}
        onRegister={async (name, phone, peopleCount, packageType) => {
          const customer = await apiRegister({
            name,
            phone,
            peopleCount,
            templateId: "4R",
            packageType,
          });
          const s = await startSession({
            user: customer.user,
            peopleCount: customer.peopleCount,
            duration: getPackageDurationMinutes(packageType, kioskConfig.packageDurations),
            packageType,
          });
          beginPreview(s);
        }}
        onCheckByName={async (name) => {
          const customer = await apiCustomerByName(name);
          if (!customer) {
            alert("Nama tidak ditemukan untuk hari ini.");
            return;
          }
          const pkg: PackageType = customer.packageType || "self-photo";
          const s = await startSession({
            user: customer.user,
            peopleCount: customer.peopleCount,
            duration: getPackageDurationMinutes(pkg, kioskConfig.packageDurations),
            packageType: pkg,
          });
          beginPreview(s);
        }}
        onBack={() => router.push("/")}
      />
    );
  }

  if (screen === "preview") {
    return (
      <main className="relative flex h-screen w-full flex-col items-center justify-center bg-black gap-4">
        <header className="absolute top-0 left-0 z-index-10 p-4 mx-auto flex w-full flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm sm:text-base text-white/90 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back
          </button>
          <div className="flex flex-wrap gap-2">
            <Pill label={`Sesi: ${session?.user ?? "-"}`} />
            <Pill label={`Shot: ${captureCount}`} />
            <Pill
              label={
                sessionTimer.isPaused
                  ? `Waktu: ${msToMMSS(sessionTimer.remainingMs)} (PAUSED)`
                  : `Waktu: ${msToMMSS(sessionTimer.remainingMs)}`
              }
              intent={sessionTimer.remainingMs <= 60_000 ? "warn" : "default"}
            />
          </div>
        </header>

        <section className="mx-auto flex w-full flex-1 flex-col gap-4">
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {lastImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lastImageUrl}
                  alt="Preview foto terakhir"
                  className="h-full w-full object-contain"
                />
                {isCapturing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-6xl font-extrabold tracking-[0.18em] text-white sm:text-8xl">
                      {captureCountdown}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-white/50">
                <p className="text-center text-sm sm:text-base">
                  Belum ada foto. Klik &quot;Ambil Foto&quot; untuk capture.
                </p>
                {isCapturing && (
                  <div className="text-6xl font-extrabold tracking-[0.18em] text-white sm:text-8xl">
                    {captureCountdown}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        <div className="absolute bottom-0 left-0 p-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 pb-4">
          <Button
            variant="destructive"
            className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
            onClick={endSession}
          >
            Akhiri Sesi
          </Button>
          {session && (
            <>
              <select
                value={trialSeconds}
                onChange={(e) => setTrialSeconds(Number(e.target.value))}
                className="h-11 rounded border border-white/20 bg-white/10 px-2 text-sm text-white"
              >
                {TRIAL_PRESETS.map((seconds) => (
                  <option key={seconds} value={seconds} className="text-black">
                    Trial {seconds}s
                  </option>
                ))}
              </select>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={async () => {
                  if (!session?.user) return;

                  try {
                    const data = await trialStart(session.user, trialSeconds);
                    sessionTimer.startWithEndsAt(data.endsAt);
                  } catch {
                    alert("Gagal start trial");
                  }
                }}
              >
                Start Trial
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={() => {
                  if (!session?.user) return;
                  trialSkip(session.user).catch(() => {});
                }}
              >
                Skip Trial
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={async () => {
                  if (!session?.user) return;

                  const pkg: PackageType = session.packageType || "self-photo";
                  const mainSeconds =
                    getPackageDurationMinutes(pkg, kioskConfig.packageDurations) * 60;

                  try {
                    const data = await mainStart(session.user, mainSeconds, pkg);
                    sessionTimer.startWithEndsAt(data.endsAt);
                  } catch {
                    alert("Gagal mulai sesi");
                  }
                }}
              >
                Mulai Sesi Utama ({mainDurationMinutes}m)
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                disabled={sessionTimer.isPaused}
                onClick={async () => {
                  try {
                    await pauseSession();
                    const { activeSession } = await getSession();
                    if (activeSession) {
                      syncTimerFromSession(activeSession, sessionTimer.syncFromServer);
                    }
                  } catch {
                    alert("Gagal pause sesi");
                  }
                }}
              >
                Pause
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                disabled={!sessionTimer.isPaused}
                onClick={async () => {
                  try {
                    const resumed = await resumeSession();
                    syncTimerFromSession(resumed, sessionTimer.syncFromServer);
                  } catch {
                    alert("Gagal resume sesi");
                  }
                }}
              >
                Resume
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={async () => {
                  try {
                    await addTime(1);
                    const { activeSession } = await getSession();
                    if (activeSession) {
                      syncTimerFromSession(activeSession, sessionTimer.syncFromServer);
                    }
                  } catch {
                    alert("Gagal tambah waktu");
                  }
                }}
              >
                +1 min
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={async () => {
                  try {
                    await addTime(5);
                    const { activeSession } = await getSession();
                    if (activeSession) {
                      syncTimerFromSession(activeSession, sessionTimer.syncFromServer);
                    }
                  } catch {
                    alert("Gagal tambah waktu");
                  }
                }}
              >
                +5 min
              </Button>
            </>
          )}
          <Button
            className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
            onClick={startCaptureCountdown}
            disabled={isCapturing}
          >
            Ambil Foto
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 sm:px-6 py-8">
      <h1 className="text-center text-3xl font-semibold tracking-wide text-white sm:text-5xl">
        Terima kasih
      </h1>
      <p className="mt-5 max-w-xl text-center text-sm text-white/60 sm:text-lg">
        Foto Anda sedang diproses.<br /> Silakan hubungi tim studio jika ingin review atau cetak.
      </p>
      <div className="mt-8 sm:mt-10 flex flex-wrap gap-3 justify-center">
        <Button
          className="rounded bg-blue-600 px-6 py-3 text-white shadow-lg hover:bg-blue-700"
          onClick={() => {
            sessionTimer.clear();
            setSession(null);
            setCaptureCount(0);
            setLastImageUrl(null);
            setScreen("register");
          }}
        >
          Kembali ke awal
        </Button>
      </div>
    </main>
  );
}

function Pill({ label, intent = "default" }: { label: string; intent?: "default" | "warn" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-1 text-md tracking-[0.22em]",
        intent === "warn"
          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
          : "border-white/15 bg-white/5 text-white/70"
      )}
    >
      {label}
    </div>
  );
}

type RegisterOrCheckScreenProps = {
  packageDurations: Record<PackageType, number>;
  onRegister: (
    name: string,
    phone: string,
    peopleCount: number,
    packageType: PackageType
  ) => Promise<void>;
  onCheckByName: (name: string) => Promise<void>;
  onBack: () => void;
};

function RegisterOrCheckScreen({
  packageDurations,
  onRegister,
  onCheckByName,
  onBack,
}: RegisterOrCheckScreenProps) {
  const [mode, setMode] = React.useState<"register" | "check">("register");
  const [checkName, setCheckName] = React.useState("");
  const [checkLoading, setCheckLoading] = React.useState(false);
  const [packageType, setPackageType] = React.useState<PackageType>("self-photo");

  const selfPhotoMinutes = packageDurations["self-photo"];
  const pasPhotoMinutes = packageDurations["pas-photo"];

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-black px-4 py-6 sm:px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("register")}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
              mode === "register"
                ? "bg-white/20 text-white"
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
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            Cek by Name
          </button>
        </div>

        {mode === "register" && (
          <>
            <h2 className="text-lg sm:text-xl font-semibold tracking-wide text-white">Registrasi</h2>
            <p className="mt-2 text-xs sm:text-sm text-white/60">
              Nama dipakai untuk folder foto. Nomor WhatsApp opsional.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = (fd.get("name") ?? "").toString().trim();
                const phone = (fd.get("phone") ?? "").toString().trim();
                const peopleCount = Number((fd.get("peopleCount") ?? "1").toString());
                if (!name) return;
                try {
                  await onRegister(
                    name,
                    phone,
                    Math.max(1, Math.min(8, peopleCount)),
                    packageType
                  );
                } catch {
                  alert("Registrasi gagal. Hubungi staf.");
                }
              }}
            >
              <div className="space-y-2">
                <label className="text-xs tracking-[0.22em] text-white/60">NAMA</label>
                <Input name="name" autoComplete="off" className="h-11" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs tracking-[0.22em] text-white/60">WHATSAPP (OPSIONAL)</label>
                <Input name="phone" autoComplete="off" className="h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-xs tracking-[0.22em] text-white/60">JUMLAH ORANG</label>
                <Input name="peopleCount" type="number" min={1} max={8} defaultValue={1} className="h-11" />
              </div>
              <div className="space-y-2">
                <label className="text-xs tracking-[0.22em] text-white/60">PAKET FOTO</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setPackageType("self-photo")}
                    className={cn(
                      "flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left text-xs sm:text-sm transition",
                      packageType === "self-photo"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <span className="font-semibold tracking-[0.18em] uppercase">
                      Self Photo Studio
                    </span>
                    <span className="mt-1 text-[11px] sm:text-xs text-white/70">
                      Durasi utama {selfPhotoMinutes} menit, pengalaman self photo bebas pose.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackageType("pas-photo")}
                    className={cn(
                      "flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left text-xs sm:text-sm transition",
                      packageType === "pas-photo"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <span className="font-semibold tracking-[0.18em] uppercase">
                      Pas Photo
                    </span>
                    <span className="mt-1 text-[11px] sm:text-xs text-white/70">
                      Durasi utama {pasPhotoMinutes} menit dengan frame pas foto di layar live preview.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackageType("ai-photo")}
                    className={cn(
                      "flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left text-xs sm:text-sm transition",
                      packageType === "ai-photo"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                    )}
                  >
                    <span className="font-semibold tracking-[0.18em] uppercase">
                      AI Photo
                    </span>
                    <span className="mt-1 text-[11px] sm:text-xs text-white/70">
                      Setelah capture, foto ditandai sebagai hasil AI di layar review.
                    </span>
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" className="h-11 flex-1" onClick={onBack}>
                  Kembali
                </Button>
                <Button type="submit" className="h-11 flex-1">
                  Mulai
                </Button>
              </div>
            </form>
          </>
        )}

        {mode === "check" && (
          <>
            <h2 className="text-lg sm:text-xl font-semibold tracking-wide text-white">Cek by Name</h2>
            <p className="mt-2 text-xs sm:text-sm text-white/60">
              Masukkan nama yang sudah terdaftar hari ini untuk mengontrol sesi.
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
                <Button type="button" className="h-11 flex-1" onClick={onBack}>
                  Kembali
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1"
                  disabled={!checkName.trim() || checkLoading}
                  onClick={async () => {
                    if (!checkName.trim()) return;
                    setCheckLoading(true);
                    try {
                      await onCheckByName(checkName.trim());
                    } finally {
                      setCheckLoading(false);
                    }
                  }}
                >
                  {checkLoading ? "Cek..." : "Cek & Mulai"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
