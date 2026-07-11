import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchKioskConfig, getApiBase } from "./config";
import {
  applyKioskSyncFields,
  triggerBackendCapture,
} from "./services/api";
import { getKioskProcessingMessage } from "./lib/processingLabels";
import { useKioskPreview } from "./hooks/useKioskPreview";
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

/** Photo review — long enough to enjoy, shorter than lingering. */
const REVIEW_DISPLAY_MS = 3000;
const FLASH_HOLD_MS = 280;

const PACKAGE_LABELS = {
  "self-photo": "Self Photo",
  "pas-photo": "Pas Photo",
  "ai-photo": "AI Photo",
};

function syncKioskFields(fields, setters) {
  applyKioskSyncFields(setters, fields);
}

export function App() {
  const { play, unlockAudio } = useKioskAudio();
  const [kioskConfig, setKioskConfig] = useState({
    sessionDurationMinutes: 10,
    captureCountdownSeconds: 3,
  });

  const [screen, setScreen] = useState(Screen.IDLE);
  const [sessionUser, setSessionUser] = useState(null);
  const [captureCountdown, setCaptureCountdown] = useState(3);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isWaitingCapture, setIsWaitingCapture] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [shotStamp, setShotStamp] = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastImageUrl, setLastImageUrl] = useState(null);
  const [lastImageProcessing, setLastImageProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [packageType, setPackageType] = useState("self-photo");
  const [passportSizeId, setPassportSizeId] = useState("3x4");
  const [themeId, setThemeId] = useState(null);
  const [themeLabels, setThemeLabels] = useState({});
  const [latestPreviewImage, setLatestPreviewImage] = useState(null);

  const sessionUserRef = useRef(sessionUser);
  const packageTypeRef = useRef(packageType);
  const screenRef = useRef(screen);
  const countdownTimerRef = useRef(null);
  const reviewTimerRef = useRef(null);
  const sessionEndingRef = useRef(false);
  const sessionEndAudioPlayedRef = useRef(false);
  sessionUserRef.current = sessionUser;
  packageTypeRef.current = packageType;
  screenRef.current = screen;

  const kioskSetters = useMemo(
    () => ({ setPackageType, setPassportSizeId, setThemeId }),
    []
  );

  const handlePreviewUpdate = useCallback(({ previewUrl, isProcessing, failed, error, image }) => {
    if (previewUrl) setLastImageUrl(previewUrl);
    if (image) setLatestPreviewImage(image);
    if (typeof isProcessing === "boolean") setLastImageProcessing(isProcessing);
    if (failed) {
      setProcessingError(error || "Proses foto gagal.");
    } else if (!isProcessing) {
      setProcessingError(null);
    }
  }, []);

  const { refreshPreview, waitForImageProcessing, handlePhotoProcessed, cancelPoll } =
    useKioskPreview({
      userSlug: sessionUser,
      packageType,
      enabled: screen === Screen.TRIAL || screen === Screen.MAIN,
      onPreviewUpdate: handlePreviewUpdate,
    });

  const { videoRef, start: startCameraPreview, stop: stopCameraPreview } = useCameraPreview();

  const clearCaptureTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (reviewTimerRef.current) {
      window.clearTimeout(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }
  }, []);

  /** Celebrate real camera capture — driven by Imaging Edge file → api `new-photo`. */
  const celebrateNewCapture = useCallback(
    async (payload) => {
      const user = sessionUserRef.current;
      const scr = screenRef.current;
      if (!user || payload?.user !== user) return;
      if (scr !== Screen.TRIAL && scr !== Screen.MAIN) return;

      unlockAudio();
      clearCaptureTimers();
      setIsCapturing(false);
      setIsReviewing(false);
      setIsFlashing(true);
      setIsWaitingCapture(false);
      setShotStamp((n) => n + 1);
      play("shutter");
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 30, 60]);
      }

      setCaptureCount((c) => c + 1);
      setProcessingError(null);

      const flashHold = new Promise((resolve) => {
        window.setTimeout(resolve, FLASH_HOLD_MS);
      });

      const pkg = packageTypeRef.current;
      const previewPromise = (async () => {
        try {
          const result = await refreshPreview();
          const latest = result?.image;
          const waitingForProcessed =
            pkg === "ai-photo" || pkg === "pas-photo"
              ? latest?.processingStatus !== "ready"
              : false;

          setLastImageProcessing(Boolean(waitingForProcessed));

          if (waitingForProcessed && (payload.imageId || latest?.imageId)) {
            void waitForImageProcessing(payload.imageId || latest.imageId);
          }
          return result;
        } catch (err) {
          console.warn("Preview refresh after new-photo failed", err);
          return null;
        }
      })();

      await flashHold;
      setIsFlashing(false);
      setIsWaitingCapture(true);

      await previewPromise;

      setIsWaitingCapture(false);
      setIsReviewing(true);
      play("captureSuccess");

      reviewTimerRef.current = window.setTimeout(() => {
        setIsReviewing(false);
        startCameraPreview();
        reviewTimerRef.current = null;
      }, REVIEW_DISPLAY_MS);
    },
    [
      clearCaptureTimers,
      play,
      refreshPreview,
      startCameraPreview,
      unlockAudio,
      waitForImageProcessing,
    ]
  );

  const celebrateNewCaptureRef = useRef(celebrateNewCapture);
  celebrateNewCaptureRef.current = celebrateNewCapture;

  const clearSessionTimerRef = useRef(() => {});

  const endSession = useCallback(() => {
    if (sessionEndingRef.current && screenRef.current === Screen.END) {
      return;
    }
    sessionEndingRef.current = true;
    clearSessionTimerRef.current();
    clearCaptureTimers();
    stopCameraPreview();
    cancelPoll();

    if (!sessionEndAudioPlayedRef.current) {
      sessionEndAudioPlayedRef.current = true;
      play("sessionEnd");
    }

    setIsCapturing(false);
    setIsFlashing(false);
    setIsWaitingCapture(false);
    setIsReviewing(false);
    setScreen(Screen.END);
    setSessionUser(null);
  }, [cancelPoll, clearCaptureTimers, play, stopCameraPreview]);

  const endSessionRef = useRef(endSession);
  endSessionRef.current = endSession;

  const sessionTimer = useSessionTimer({
    durationMs: kioskConfig.sessionDurationMinutes * 60 * 1000,
    onExpire: () => {
      endSessionRef.current();
    },
    onWarn: () => play("timeWarning"),
  });
  clearSessionTimerRef.current = sessionTimer.clear;

  const remainingMs = sessionTimer.remainingMs;

  const remainingLabel = useMemo(() => {
    if (!remainingMs) return "10:00";
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [remainingMs]);

  const processingMessage = useMemo(
    () =>
      getKioskProcessingMessage(
        packageType,
        lastImageProcessing,
        latestPreviewImage,
        isReviewing
      ),
    [packageType, lastImageProcessing, latestPreviewImage, isReviewing]
  );

  const themeLabel = themeId ? themeLabels[themeId] ?? null : null;

  useEffect(() => {
    fetchKioskConfig().then(setKioskConfig).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${getApiBase()}/api/themes`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.themes) return;
        const labels = {};
        for (const theme of data.themes) {
          labels[theme.id] = theme.label;
        }
        setThemeLabels(labels);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = io(getApiBase(), {
      transports: ["websocket"],
    });

    socket.on("kiosk-trial-start", ({ user, endsAt, ...fields }) => {
      sessionEndingRef.current = false;
      sessionEndAudioPlayedRef.current = false;
      clearCaptureTimers();
      unlockAudio();
      setSessionUser(user);
      setScreen(Screen.TRIAL);
      setCaptureCount(0);
      setLastImageUrl(null);
      setLastImageProcessing(false);
      setProcessingError(null);
      setIsCapturing(false);
      setIsFlashing(false);
      setIsWaitingCapture(false);
      setIsReviewing(false);
      syncKioskFields(fields, kioskSetters);
      sessionTimer.startWithEndsAt(endsAt);
      startCameraPreview();
    });

    socket.on("kiosk-trial-skip", ({ user }) => {
      if (!sessionUser || sessionUser === user) {
        sessionTimer.clear();
        cancelPoll();
        setScreen(Screen.IDLE);
      }
    });

    socket.on("kiosk-main-start", ({ user, endsAt, ...fields }) => {
      sessionEndingRef.current = false;
      sessionEndAudioPlayedRef.current = false;
      clearCaptureTimers();
      unlockAudio();
      setSessionUser(user);
      setScreen(Screen.MAIN);
      setCaptureCount(0);
      setLastImageUrl(null);
      setLastImageProcessing(false);
      setProcessingError(null);
      setIsCapturing(false);
      setIsFlashing(false);
      setIsWaitingCapture(false);
      setIsReviewing(false);
      syncKioskFields(fields, kioskSetters);
      sessionTimer.startWithEndsAt(endsAt);
      startCameraPreview();
    });

    socket.on("session-ended", () => {
      endSessionRef.current();
    });

    socket.on("session-state", ({ activeSession, sessionLocked, timer }) => {
      if (sessionLocked || !timer || sessionEndingRef.current) return;

      setSessionUser(timer.user);
      syncKioskFields(timer, kioskSetters);
      if (activeSession?.packageType && !timer.packageType) {
        setPackageType(activeSession.packageType);
      }

      sessionTimer.syncFromServer({
        endsAt: timer.endsAt,
        pausedAt: timer.pausedAt,
        remainingMs: timer.remainingMs,
      });

      if (timer.phase === "trial") {
        setScreen(Screen.TRIAL);
        startCameraPreview();
      } else if (timer.phase === "main") {
        setScreen(Screen.MAIN);
        startCameraPreview();
      }
    });

    socket.on(
      "session-timer-update",
      ({ user, endsAt, pausedAt, remainingMs: remaining, phase, ...fields }) => {
        // Avoid reviving preview after local/server session end
        if (sessionEndingRef.current) return;
        if (typeof remaining === "number" && remaining <= 0 && !pausedAt) {
          endSessionRef.current();
          return;
        }

        setSessionUser(user);
        syncKioskFields(fields, kioskSetters);
        sessionTimer.syncFromServer({ endsAt, pausedAt, remainingMs: remaining });

        if (pausedAt) return;

        if (phase === "trial") {
          setScreen(Screen.TRIAL);
          startCameraPreview();
        } else if (phase === "main") {
          setScreen(Screen.MAIN);
          startCameraPreview();
        }
      }
    );

    socket.on("session-paused", ({ remainingMs: remaining }) => {
      sessionTimer.syncFromServer({
        pausedAt: Date.now(),
        remainingMs: remaining,
      });
    });

    socket.on("session-resumed", (session) => {
      sessionTimer.syncFromServer({
        endsAt: session.endsAt,
        pausedAt: null,
        remainingMs: Math.max(0, session.endsAt - Date.now()),
      });
    });

    socket.on("photo-processed", handlePhotoProcessed);

    // Real shutter moment: file landed from camera (Imaging Edge → capture/)
    socket.on("new-photo", (payload) => {
      void celebrateNewCaptureRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== Screen.TRIAL && screen !== Screen.MAIN) return;
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [screen, unlockAudio]);

  async function handleCapture() {
    if (!sessionUser) return;
    const userSlug = sessionUser;

    try {
      await triggerBackendCapture(userSlug);
    } catch (e) {
      console.warn("Backend capture trigger failed or not configured", e);
    }

    if (window.kiosk?.camera) {
      await window.kiosk.camera.capture({
        userSlug,
        targetFolderHint: `/SudutPandangStudio/<today>/${userSlug}`,
      });
    }
  }

  /** Optional pose countdown + software trigger. Shutter SFX waits for `new-photo`. */
  function startCaptureCountdown() {
    if (isCapturing || isReviewing || !sessionUser) return;
    unlockAudio();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(18);
    }

    const total = kioskConfig.captureCountdownSeconds || 3;
    clearCaptureTimers();
    setIsFlashing(false);
    setIsCapturing(true);
    setCaptureCountdown(total);
    play("beep", { remaining: total });

    let localCount = total;
    countdownTimerRef.current = window.setInterval(async () => {
      if (localCount <= 1) {
        if (countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setIsCapturing(false);
        await handleCapture();
        return;
      }
      localCount -= 1;
      play("beep", { remaining: localCount });
      setCaptureCountdown(localCount);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(localCount === 1 ? 28 : 12);
      }
    }, 1000);
  }

  if (screen === Screen.IDLE) {
    return (
      <div className="screen screen--idle">
        <img src="/logo-light.png" height={150} alt="Sudut Pandang" />
        <div className="pill">Self Photo Session</div>
        <p className="subheadline text-center">
          Menunggu sesi dari operator.
          <br />
          Registrasi dan kontrol sesi dilakukan dari operator kiosk.
        </p>
      </div>
    );
  }

  if (screen === Screen.TRIAL || screen === Screen.MAIN) {
    const phaseLabel = screen === Screen.TRIAL ? "Trial Session:" : "Halo,";
    const isPasPhoto = packageType === "pas-photo";
    const isAiPhoto = packageType === "ai-photo";
    const passportAspect =
      passportSizeId === "2x3"
        ? "2 / 3"
        : passportSizeId === "4x6"
          ? "4 / 6"
          : "3 / 4";

    return (
      <div className="screen screen--preview">
        <div className="preview-wrapper">
          {!isReviewing && !isWaitingCapture && !isFlashing && (
            <div className="preview-header flex flex-row justify-between items-center gap-2">
              <div className="pill">
                {phaseLabel} {sessionUser ?? "-"}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <div className="pill pill--package">{PACKAGE_LABELS[packageType] ?? packageType}</div>
                {isAiPhoto && themeId && (
                  <div className="pill pill--theme">
                    Tema: {themeLabel ?? "AI Photo"}
                  </div>
                )}
              </div>
            </div>
          )}

          {isCapturing && (
            <div
              className={`capture-overlay capture-overlay--countdown${
                captureCountdown <= 1 ? " capture-overlay--urgent" : ""
              }`}
              aria-live="polite"
            >
              <div className="capture-countdown-ring" key={`ring-${captureCountdown}`}>
                <div
                  key={captureCountdown}
                  className={`capture-overlay-number${
                    captureCountdown <= 1 ? " capture-overlay-number--final" : ""
                  }`}
                >
                  {captureCountdown}
                </div>
              </div>
              <div className="capture-overlay-hint">
                {captureCountdown <= 1 ? "Pose!" : "Siap…"}
              </div>
            </div>
          )}

          {isFlashing && (
            <div className="capture-flash" aria-hidden="true" />
          )}

          {isWaitingCapture && (
            <div className="capture-wait" aria-live="polite">
              <div className="capture-wait-text">Mengambil foto…</div>
              <div className="capture-wait-sub">Mohon tunggu sebentar</div>
            </div>
          )}

          {!isReviewing && !isWaitingCapture && (
            <div
              className={`preview-video-wrapper${
                isCapturing ? " preview-video-wrapper--countdown" : ""
              }`}
            >
              <video className="preview-video" ref={videoRef} playsInline muted />
              {isPasPhoto && (
                <div className="pas-photo-frame">
                  <div
                    className="pas-photo-inner"
                    style={{ aspectRatio: passportAspect }}
                  />
                </div>
              )}
              {isAiPhoto && (
                <div className="ai-photo-badge">Mode AI Photo</div>
              )}
            </div>
          )}

          {isReviewing && lastImageUrl && (
            <div className="capture-overlay capture-overlay--review" key={`review-${shotStamp}`}>
              <img
                src={lastImageUrl}
                alt="Foto terakhir"
                className="capture-review-image"
              />
              <div className="capture-review-badge">Hasil foto</div>
              {lastImageProcessing && (
                <div className="processing-overlay">
                  <div className="processing-spinner" />
                </div>
              )}
              <div className="capture-review-caption">
                {processingMessage ||
                  (isAiPhoto
                    ? "Foto AI siap"
                    : "Lihat hasilnya — sesi lanjut sebentar lagi")}
              </div>
            </div>
          )}

          {!isReviewing && !isWaitingCapture && lastImageUrl && (
            <div
              className={`last-shot-thumb${lastImageProcessing ? " last-shot-thumb--processing" : ""}`}
            >
              <img src={lastImageUrl} alt="Foto terakhir" />
              {lastImageProcessing && (
                <div className="last-shot-thumb-overlay">
                  <div className="processing-spinner processing-spinner--sm" />
                </div>
              )}
              <div className="last-shot-label">
                {lastImageProcessing
                  ? processingMessage || "Memproses…"
                  : "Foto terakhir"}
              </div>
            </div>
          )}

          {processingError && (
            <div className="kiosk-processing-error">{processingError}</div>
          )}

          {!isReviewing && !isWaitingCapture && !isFlashing && (
            <div className="preview-toolbar">
              <div className="pill-big">{remainingLabel}</div>
              {/* <button
                type="button"
                className={`primary-button preview-capture-button${
                  isCapturing ? " preview-capture-button--armed" : ""
                }`}
                onClick={startCaptureCountdown}
                disabled={isCapturing || isReviewing || !sessionUser}
              >
                {isCapturing ? "Mengambil…" : "Ambil Foto"}
              </button> */}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === Screen.END) {
    return (
      <div className="screen screen--idle screen--end">
        <div className="headline">Terima kasih</div>
        <p className="subheadline">
          Foto Anda sedang diproses.
          <br />
          Silakan hubungi tim studio bila ingin melihat atau mencetak lebih banyak.
        </p>
      </div>
    );
  }

  return (
    <div className="screen screen--idle">
      <img src="/logo-light.png" height={150} alt="Sudut Pandang" />
      <div className="pill">Self Photo Session</div>
      <p className="subheadline text-center">
        Menunggu sesi dari operator.
        <br />
        Registrasi dan kontrol sesi dilakukan dari operator kiosk.
      </p>
    </div>
  );
}
