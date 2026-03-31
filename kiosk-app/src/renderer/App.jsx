import React, { useEffect, useMemo, useState } from "react";
import { fetchKioskConfig, getApiBase } from "./config";
import { fetchLatestImage, triggerBackendCapture } from "./services/api";
import { useKioskAudio } from "./services/audio";
import { useSessionTimer } from "./hooks/useSessionTimer";
import { useCameraPreview } from "./hooks/useCameraPreview";
import { io } from "socket.io-client";

const Screen = {
  IDLE: "idle",
  TRIAL: "trial",
  MAIN: "main",
  END: "end",
};

export function App() {
  const { play } = useKioskAudio();
  const [kioskConfig, setKioskConfig] = useState({
    sessionDurationMinutes: 10,
    captureCountdownSeconds: 3,
  });

  const [screen, setScreen] = useState(Screen.IDLE);
  const [sessionUser, setSessionUser] = useState(null);
  const [captureCountdown, setCaptureCountdown] = useState(3);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastImageUrl, setLastImageUrl] = useState(null);
  const [packageType, setPackageType] = useState("self-photo");

  const { videoRef, start: startCameraPreview, stop: stopCameraPreview, ready: cameraReady } = useCameraPreview();

  const sessionTimer = useSessionTimer({
    durationMs: kioskConfig.sessionDurationMinutes * 60 * 1000,
    onExpire: () => {
      play("sessionEnd");
      stopCameraPreview();
      setScreen(Screen.END);
      setSessionUser(null);
    },
    onWarn: () => play("timeWarning"),
  });

  const remainingMs = sessionTimer.remainingMs;

  const remainingLabel = useMemo(() => {
    if (!remainingMs) return "10:00";
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [remainingMs]);

  // Fetch kiosk config from API on first mount
  useEffect(() => {
    fetchKioskConfig().then(setKioskConfig).catch(() => {});
  }, []);

  // Socket.IO: dengar event dari API yang dikontrol studio-kiosk
  useEffect(() => {
    const socket = io(getApiBase(), {
      transports: ["websocket"],
    });

    socket.on("kiosk-trial-start", ({ user, endsAt }) => {
      setSessionUser(user);
      setScreen(Screen.TRIAL);
      setCaptureCount(0);
      setLastImageUrl(null);
      sessionTimer.startWithEndsAt(endsAt);
      startCameraPreview();
    });

    socket.on("kiosk-trial-skip", ({ user }) => {
      if (!sessionUser || sessionUser === user) {
        // Kembali ke idle menunggu sesi utama
        sessionTimer.clear();
        setScreen(Screen.IDLE);
      }
    });

    socket.on("kiosk-main-start", ({ user, endsAt, packageType: pkg }) => {
      setSessionUser(user);
      setScreen(Screen.MAIN);
      setCaptureCount(0);
      setLastImageUrl(null);
      setPackageType(pkg || "self-photo");
      sessionTimer.startWithEndsAt(endsAt);
      startCameraPreview();
    });

    socket.on("session-ended", () => {
      console.log("session-ended");
      play("sessionEnd");
      stopCameraPreview();
      sessionTimer.clear();
      setScreen(Screen.END);
      setSessionUser(null);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCapture() {
    if (!sessionUser) return;
    const userSlug = sessionUser;

    // 1) Ask backend to run camera command (if configured)
    try {
      await triggerBackendCapture(userSlug);
    } catch (e) {
      console.warn("Backend capture trigger failed or not configured", e);
    }

    // 2) Optionally also call Electron IPC camera, if implemented
    if (window.kiosk?.camera) {
      await window.kiosk.camera.capture({
        userSlug,
        targetFolderHint: `/SudutPandangStudio/<today>/${userSlug}`,
      });
    }

    setCaptureCount((c) => c + 1);
    setTimeout(async () => {
      const latest = await fetchLatestImage(userSlug);
      if (latest?.url) setLastImageUrl(latest.url);
    }, 1500);
  }

  function startCaptureCountdown() {
    if (isCapturing || isReviewing || !sessionUser) return;
    const total = kioskConfig.captureCountdownSeconds || 3;
    setIsCapturing(true);
    setCaptureCountdown(total);

    let localCount = total;
    const timer = setInterval(async () => {
      if (localCount <= 1) {
        clearInterval(timer);
        play("shutter");
        await handleCapture();
        setIsCapturing(false);
        setIsReviewing(true);
        // Tampilkan preview penuh selama 3 detik lalu kembali ke live view
        setTimeout(() => {
          setIsReviewing(false);
          // Pastikan live preview kamera aktif kembali (beberapa kamera freeze saat capture)
          startCameraPreview();
        }, 3000);
        return;
      }
      localCount -= 1;
      play("beep");
      setCaptureCountdown(localCount);
    }, 1000);
  }

  function handleBackToIdle() {
    stopCameraPreview();
    sessionTimer.clear();
    setLastImageUrl(null);
    setCaptureCount(0);
    setScreen(Screen.IDLE);
  }

  // Screens
  if (screen === Screen.IDLE) {
    return (
      <div className="screen screen--idle">
        <img src="/logo-light.png" height={150} />
        <div className="pill">Self Photo Session</div>
        <p className="subheadline text-center">
          Menunggu sesi dari operator.<br/> Registrasi dan kontrol sesi
          dilakukan dari operator kiosk.
        </p>
      </div>
    );
  }

  if (screen === Screen.TRIAL || screen === Screen.MAIN) {
    const phaseLabel = screen === Screen.TRIAL ? "Trial Session:" : "Halo,";
    const isPasPhoto = packageType === "pas-photo";
    const isAiPhoto = packageType === "ai-photo";
    return (
      <div className="screen screen--preview">
        <div className="preview-wrapper">
          <div className="preview-header flex flex-row justify-between items-center gap-2">
            <div className="pill">{phaseLabel} {sessionUser ?? "-"}</div>
            {/* <div className="pill">Shots: {captureCount}</div> */}
          </div>
          
          {isCapturing && (
            <div className="capture-overlay">
              <div className="capture-overlay-number">{captureCountdown}</div>
            </div>
          )}
          {!isReviewing && (
            <div className="preview-video-wrapper">
              <video
                className="preview-video"
                ref={videoRef}
                playsInline
                muted
              />
              {isPasPhoto && (
                <div className="pas-photo-frame">
                  <div className="pas-photo-inner" />
                </div>
              )}
            </div>
          )}
          {isReviewing && lastImageUrl && (
            <div className="capture-overlay">
              <img src={lastImageUrl} alt="Foto terakhir" className="preview-video" />
              <div className="last-shot-label">
                {isAiPhoto
                  ? "Menghasilkan foto AI... harap tunggu sebentar"
                  : "Menampilkan hasil foto... sesi lanjut sebentar lagi"}
              </div>
            </div>
          )}
          {!isReviewing && lastImageUrl && (
            <div className="last-shot-thumb">
              <img src={lastImageUrl} alt="Foto terakhir" />
              <div className="last-shot-label">Foto terakhir</div>
            </div>
          )}

          <div className="preview-toolbar">
            <div className="pill-big">
              {remainingLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // END screen
  return (
    <div className="screen screen--idle">
      <div className="headline">Terima kasih</div>
      <p className="subheadline">
        Foto Anda sedang diproses.<br/> Silakan hubungi tim studio bila ingin
        melihat atau mencetak lebih banyak.
      </p>
      {/* <Button onClick={handleBackToIdle}>Kembali ke layar awal</Button> */}
    </div>
  );
}

