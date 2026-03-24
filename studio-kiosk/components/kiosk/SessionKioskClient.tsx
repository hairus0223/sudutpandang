"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Screen = "register" | "preview" | "end";

type Session = {
  user: string;
  peopleCount: number;
  endsAt: number;
  pausedAt: number | null;
  remainingMs: number | null;
  packageType?: PackageType;
};

type PackageType = "self-photo" | "pas-photo" | "ai-photo";

type Customer = {
  user: string;
  name: string;
  phone: string;
  peopleCount: number;
  templateId: string;
  packageType?: PackageType;
};

const SESSION_DURATION_MS = 10 * 60 * 1000;

function msToMMSS(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

async function apiRegister(
  payload: {
    name: string;
    phone: string;
    peopleCount: number;
    templateId: string;
    packageType: PackageType;
  }
): Promise<Customer> {
  const res = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("register_failed");
  const data = (await res.json()) as { customer: Customer };
  return data.customer;
}

async function apiSessionStart(
  payload: {
    user: string;
    peopleCount: number;
    duration: number;
    packageType: PackageType;
  }
): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("session_start_failed");

  const data = await res.json();

  console.log("SESSION FROM API:", data.session); // ✅ DEBUG

  return data.session;
}

async function apiSessionStop(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/session/stop`, { method: "POST" });
}

async function apiKioskTrialStart(user: string, durationSeconds = 60) {
  await fetch(`${API_BASE_URL}/api/kiosk/trial-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, durationSeconds }),
  });
}

async function apiKioskTrialSkip(user: string) {
  await fetch(`${API_BASE_URL}/api/kiosk/trial-skip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
}

async function apiKioskMainStart(
  user: string,
  durationSeconds: number,
  packageType: PackageType
) {
  await fetch(`${API_BASE_URL}/api/kiosk/main-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, durationSeconds, packageType }),
  });
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

export function SessionKioskClient() {
  const router = useRouter();
  const [screen, setScreen] = React.useState<Screen>("register");
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [captureCountdown, setCaptureCountdown] = React.useState(3);
  const [captureCount, setCaptureCount] = React.useState(0);
  const [session, setSession] = React.useState<Session | null>(null);
  const [sessionEndsAt, setSessionEndsAt] = React.useState<number | null>(null);
  const [remainingMs, setRemainingMs] = React.useState<number>(SESSION_DURATION_MS);
  const [lastImageUrl, setLastImageUrl] = React.useState<string | null>(null);

  const captureTimerRef = React.useRef<number | null>(null);
  const sessionTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
      if (sessionTimerRef.current) window.clearInterval(sessionTimerRef.current);
    };
  }, []);

  const refreshLastImage = React.useCallback(async () => {
    if (!session?.user) return;
    const url = await apiLatestImageUrl(session.user);
    if (url) setLastImageUrl(url);
  }, [session?.user]);

  // Session timer
  React.useEffect(() => {
    if (!sessionEndsAt) return;

    if (sessionTimerRef.current) window.clearInterval(sessionTimerRef.current);
    sessionTimerRef.current = window.setInterval(async () => {
      const remaining = sessionEndsAt - Date.now();
      if (remaining <= 0) {
        if (sessionTimerRef.current) window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
        await apiSessionStop().catch(() => { });
        setScreen("end");
        setSession(null);
        setSessionEndsAt(null);
        setRemainingMs(0);
        return;
      }

      setRemainingMs(remaining);
    }, 1000);

    return () => {
      if (sessionTimerRef.current) window.clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    };
  }, [sessionEndsAt]);

  // Realtime preview: poll latest image when on preview screen.
  // Must stay here (top-level) to keep hook order stable.
  React.useEffect(() => {
    if (screen !== "preview" || !session?.user) return;
    refreshLastImage();
    const t = window.setInterval(() => refreshLastImage(), 2000);
    return () => window.clearInterval(t);
  }, [refreshLastImage, screen, session?.user]);

  const handleCapture = React.useCallback(async () => {
    // In Next.js kiosk mode (browser), we cannot control Sony directly.
    // The capture trigger should be performed by Electron shell / backend integration later.
    // For now, we only refresh latest image after capture should have happened externally.
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
    await apiSessionStop().catch(() => { });
    setScreen("end");
    setSession(null);
    setSessionEndsAt(null);
    setLastImageUrl(null);
  }, []);

  if (screen === "register") {
    return (
      <RegisterOrCheckScreen
        onRegister={async (name, phone, peopleCount, packageType) => {
          const customer = await apiRegister({
            name,
            phone,
            peopleCount,
            templateId: "4R",
            packageType,
          });
          const s = await apiSessionStart({
            user: customer.user,
            peopleCount: customer.peopleCount,
            duration: packageType === "pas-photo" ? 5 : 10,
            packageType,
          });
          setSession(s);
          setCaptureCount(0);
          setLastImageUrl(null);
          setSessionEndsAt(s.endsAt);
          setRemainingMs(s.endsAt - Date.now());
          setScreen("preview");
        }}
        onCheckByName={async (name) => {
          const customer = await apiCustomerByName(name);
          if (!customer) {
            alert("Nama tidak ditemukan untuk hari ini.");
            return;
          }
          const pkg: PackageType = customer.packageType || "self-photo";
          const s = await apiSessionStart({
            user: customer.user,
            peopleCount: customer.peopleCount,
            duration: pkg === "pas-photo" ? 5 : 10,
            packageType: pkg,
          });
          setSession(s);
          setCaptureCount(0);
          setLastImageUrl(null);
          setSessionEndsAt(s.endsAt);
          setRemainingMs(s.endsAt - Date.now());
          setScreen("preview");
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
            <Pill label={`Waktu: ${msToMMSS(remainingMs)}`} intent={remainingMs <= 60_000 ? "warn" : "default"} />
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
                <p className="text-center text-sm sm:text-base">Belum ada foto. Klik &quot;Ambil Foto&quot; untuk capture.</p>
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
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={() => {
                  if (!session?.user) return;
                  const pkg: PackageType = session.packageType || "self-photo";
                  const mainSeconds = 1 * 60;
                  apiKioskMainStart(session.user, mainSeconds, pkg).catch(() => { });
                  setSessionEndsAt(Date.now() + mainSeconds * 1000);
                  setRemainingMs(mainSeconds * 1000);
                }}
              >
                Start Trial
              </Button>
              <Button

                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={() => {
                  if (!session?.user) return;
                  apiKioskTrialSkip(session.user).catch(() => { });
                }}
              >
                Skip Trial
              </Button>
              <Button
                className="rounded bg-blue-600 h-11 text-white shadow-lg hover:bg-blue-700 text-sm sm:text-base"
                onClick={() => {
                  if (!session?.user) return;
                  const pkg: PackageType = session.packageType || "self-photo";
                  const mainSeconds = (pkg === "pas-photo" ? 5 : 10) * 60;
                  apiKioskMainStart(session.user, mainSeconds, pkg).catch(() => { });
                  setSessionEndsAt(Date.now() + mainSeconds * 1000);
                  setRemainingMs(mainSeconds * 1000);
                }}
              >
                Mulai Sesi Utama ({session?.packageType === "pas-photo" ? "5m" : "10m"})
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

  // end
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 sm:px-6 py-8">
      <h1 className="text-center text-3xl font-semibold tracking-wide text-white sm:text-5xl">
        Terima kasih
      </h1>
      <p className="mt-5 max-w-xl text-center text-sm text-white/60 sm:text-lg">
        Foto Anda sedang diproses.<br/> Silakan hubungi tim studio jika ingin review atau cetak.
      </p>
      <div className="mt-8 sm:mt-10 flex flex-wrap gap-3 justify-center">
        <Button
          className="rounded bg-blue-600 px-6 py-3 text-white shadow-lg hover:bg-blue-700"
          onClick={() => {
            setSession(null);
            setSessionEndsAt(null);
            setRemainingMs(SESSION_DURATION_MS);
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
  onRegister: (
    name: string,
    phone: string,
    peopleCount: number,
    packageType: PackageType
  ) => Promise<void>;
  onCheckByName: (name: string) => Promise<void>;
  onBack: () => void;
};

function RegisterOrCheckScreen({ onRegister, onCheckByName, onBack }: RegisterOrCheckScreenProps) {
  const [mode, setMode] = React.useState<"register" | "check">("register");
  const [checkName, setCheckName] = React.useState("");
  const [checkLoading, setCheckLoading] = React.useState(false);
  const [packageType, setPackageType] = React.useState<PackageType>("self-photo");

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
                      Durasi utama 10 menit, pengalaman self photo bebas pose.
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
                      Durasi utama 5 menit dengan frame pas foto di layar live preview.
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
                <Button
                  type="button"

                  className="h-11 flex-1"
                  onClick={onBack}
                >
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

