import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchKioskConfig, getApiBase } from "./config";
import {
  applyKioskSyncFields,
  triggerBackendCapture,
  triggerWebcamCapture,
} from "./services/api";
import { getKioskProcessingMessage } from "./lib/processingLabels";
import { getPackageLabel } from "./lib/packageTypes";
import { useKioskPreview } from "./hooks/useKioskPreview";
import { useKioskAudio } from "./services/audio";
import { useSessionTimer } from "./hooks/useSessionTimer";
import { useCameraPreview } from "./hooks/useCameraPreview";
import { useViewportLayout } from "./hooks/useViewportLayout";
import { AiSessionIntro } from "./components/AiSessionIntro";
import { io } from "socket.io-client";

const Screen = {
  IDLE: "idle",
  TRIAL: "trial",
  MAIN: "main",
  END: "end",
};

/** Photo review — long enough to enjoy, shorter than lingering. */
const REVIEW_DISPLAY_MS = 3200;
const FLASH_HOLD_MS = 280;

function syncKioskFields(fields, setters) {
  applyKioskSyncFields(setters, fields);
}

export function App() {
  useViewportLayout();
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
  const [latestPreviewImage, setLatestPreviewImage] = useState(null);
  const [packageType, setPackageType] = useState("self-photo");
  const [aiThemeLabel, setAiThemeLabel] = useState(null);
  const [aiThemePreviewUrl, setAiThemePreviewUrl] = useState(null);
  const [aiThemePreviewColor, setAiThemePreviewColor] = useState(null);
  const [aiThemeType, setAiThemeType] = useState(null);
  const [aiGenerateLimit, setAiGenerateLimit] = useState(0);
  const [showAiIntro, setShowAiIntro] = useState(false);
  const [endedPackageType, setEndedPackageType] = useState("self-photo");
  const [endedAiThemeLabel, setEndedAiThemeLabel] = useState(null);
  const [endedAiGenerateLimit, setEndedAiGenerateLimit] = useState(0);

  const sessionUserRef = useRef(sessionUser);
  const screenRef = useRef(screen);
  const countdownTimerRef = useRef(null);
  const reviewTimerRef = useRef(null);
  const sessionEndingRef = useRef(false);
  const sessionEndAudioPlayedRef = useRef(false);
  const startCameraPreviewRef = useRef(() => {});
  sessionUserRef.current = sessionUser;
  screenRef.current = screen;

  const kioskSetters = useMemo(
    () => ({
      setPackageType,
      setAiThemeLabel,
      setAiThemePreviewUrl,
      setAiThemePreviewColor,
      setAiThemeType,
      setAiGenerateLimit,
    }),
    []
  );

  const dismissAiIntro = useCallback(() => {
    setShowAiIntro(false);
  }, []);

  const maybeShowAiIntro = useCallback((fields) => {
    if (
      fields?.packageType === "ai-self-photo" &&
      (fields?.aiThemeLabel || fields?.aiThemePreviewUrl)
    ) {
      setShowAiIntro(true);
    }
  }, []);

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

  const { refreshPreview, handlePhotoProcessed, cancelPoll } =
    useKioskPreview({
      userSlug: sessionUser,
      enabled: screen === Screen.TRIAL || screen === Screen.MAIN,
      onPreviewUpdate: handlePreviewUpdate,
    });

  const { videoRef, start: startCameraPreview, stop: stopCameraPreview } = useCameraPreview();
  startCameraPreviewRef.current = startCameraPreview;

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

  const endReviewAndResume = useCallback(() => {
    setIsReviewing(false);
    startCameraPreviewRef.current();
    reviewTimerRef.current = null;
  }, []);

  const scheduleReviewEnd = useCallback(
    (ms) => {
      if (reviewTimerRef.current) {
        window.clearTimeout(reviewTimerRef.current);
      }
      reviewTimerRef.current = window.setTimeout(() => {
        endReviewAndResume();
      }, ms);
    },
    [endReviewAndResume]
  );

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

      const previewPromise = (async () => {
        try {
          return await refreshPreview();
        } catch (err) {
          console.warn("Preview refresh after new-photo failed", err);
          return null;
        }
      })();

      await flashHold;
      setIsFlashing(false);
      setIsWaitingCapture(true);

      await previewPromise;
      setLastImageProcessing(false);
      setIsWaitingCapture(false);
      setIsReviewing(true);
      play("captureSuccess");
      scheduleReviewEnd(REVIEW_DISPLAY_MS);
    },
    [
      clearCaptureTimers,
      play,
      refreshPreview,
      scheduleReviewEnd,
      unlockAudio,
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
    setEndedPackageType(packageType);
    setEndedAiThemeLabel(aiThemeLabel);
    setEndedAiGenerateLimit(aiGenerateLimit);
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
    setShowAiIntro(false);
    setScreen(Screen.END);
    setSessionUser(null);
  }, [cancelPoll, clearCaptureTimers, play, stopCameraPreview, packageType, aiThemeLabel, aiGenerateLimit]);

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
    () => getKioskProcessingMessage(lastImageProcessing, latestPreviewImage),
    [lastImageProcessing, latestPreviewImage]
  );

  useEffect(() => {
    fetchKioskConfig().then(setKioskConfig).catch(() => {});
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
      maybeShowAiIntro(fields);
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
      maybeShowAiIntro(fields);
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

    // Operator "Ambil Foto" — sync countdown on customer display
    socket.on("kiosk-capture-start", ({ user, countdownSeconds }) => {
      if (sessionUserRef.current !== user) return;
      const scr = screenRef.current;
      if (scr !== Screen.TRIAL && scr !== Screen.MAIN) return;
      runCaptureCountdownRef.current(countdownSeconds);
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

    let captured = false;

    try {
      await triggerBackendCapture(userSlug);
      captured = true;
    } catch (e) {
      console.warn("Backend capture trigger failed or not configured", e);
    }

    if (!captured) {
      try {
        await triggerWebcamCapture(videoRef.current);
        captured = true;
      } catch (webcamErr) {
        console.warn("Webcam dev capture failed", webcamErr);
      }
    }

    if (!captured && window.kiosk?.camera) {
      await window.kiosk.camera.capture({
        userSlug,
        targetFolderHint: `/SudutPandangStudio/<today>/${userSlug}`,
      });
    }
  }

  /** Countdown then shutter — invoked locally or via operator socket sync. */
  const runCaptureCountdown = useCallback(
    (totalSeconds) => {
      if (isCapturing || isReviewing || !sessionUser) return;
      unlockAudio();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(18);
      }

      const total = totalSeconds || kioskConfig.captureCountdownSeconds || 3;
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
    },
    [
      clearCaptureTimers,
      isCapturing,
      isReviewing,
      kioskConfig.captureCountdownSeconds,
      play,
      sessionUser,
      unlockAudio,
    ]
  );

  const runCaptureCountdownRef = useRef(runCaptureCountdown);
  runCaptureCountdownRef.current = runCaptureCountdown;

  function startCaptureCountdown() {
    runCaptureCountdown(kioskConfig.captureCountdownSeconds || 3);
  }

  if (screen === Screen.IDLE) {
    return (
      <div className="screen screen--idle">
        <div className="idle-content">
          <div className="idle-logo-wrap">
            <img src="./logo-light.png" className="idle-logo" alt="Sudut Pandang" />
          </div>
          <div className="idle-badge">Self Photo Studio</div>
          <h1 className="idle-title">Siap untuk sesi foto</h1>
          <p className="idle-subtitle">
            Menunggu operator memulai sesi.
            <br />
            Registrasi &amp; kontrol dari meja operator.
          </p>
          <div className="idle-pulse" aria-hidden="true">
            <span className="idle-pulse-dot" />
            <span className="idle-pulse-label">Standby</span>
          </div>
        </div>
        {import.meta.env.DEV && (
          <div className="dev-badge" title="Development mode — webcam capture">
            Dev · Webcam
          </div>
        )}
      </div>
    );
  }

  if (screen === Screen.TRIAL || screen === Screen.MAIN) {
    const phaseLabel = screen === Screen.TRIAL ? "Trial Session:" : "Halo,";
    const isAiPackage = packageType === "ai-self-photo";
    const themeName = aiThemeLabel ?? "tema pilihan";
    const reviewCaption = isAiPackage
      ? aiThemeType === "transform"
        ? `Foto tersimpan ✓ — siap di-transform ke ${themeName}`
        : `Foto tersimpan ✓ — siap diubah ke latar ${themeName}`
      : processingMessage || "Lihat hasilnya — sesi lanjut sebentar lagi";
    const footerHint =
      screen === Screen.TRIAL
        ? isAiPackage
          ? `Coba pose — nanti hasil AI tema ${themeName}`
          : "Trial — lihat ke kamera & senyum"
        : isAiPackage
          ? `Pose natural — transformasi AI di meja operator (${themeName})`
          : "Operator akan mengambil foto untuk Anda";
    const videoWrapperStyle =
      isAiPackage && aiThemePreviewColor
        ? { "--ai-theme-color": aiThemePreviewColor }
        : undefined;

    return (
      <div className="screen screen--preview">
        {isAiPackage ? (
          <AiSessionIntro
            open={showAiIntro}
            themeLabel={aiThemeLabel}
            themePreviewUrl={aiThemePreviewUrl}
            themeType={aiThemeType}
            aiGenerateLimit={aiGenerateLimit}
            onDismiss={dismissAiIntro}
          />
        ) : null}
        <div className="kiosk-shell">
          <div className="preview-wrapper">
          {!isReviewing && !isWaitingCapture && !isFlashing && (
            <header className="preview-header">
              <div className="preview-header__primary">
                <div className="pill pill--session">
                  {phaseLabel} <strong>{sessionUser ?? "-"}</strong>
                </div>
                <div className="pill pill--timer pill-big" aria-live="polite">
                  {remainingLabel}
                </div>
              </div>
              <div className="preview-header__meta">
                <div className="pill pill--package">{getPackageLabel(packageType)}</div>
                {packageType === "ai-self-photo" && aiThemeLabel ? (
                  <div className="pill pill--ai-theme">
                    {aiThemePreviewUrl ? (
                      <img
                        src={aiThemePreviewUrl}
                        alt=""
                        className="pill-theme-thumb"
                      />
                    ) : null}
                    {aiThemeLabel}
                  </div>
                ) : null}
                {packageType === "ai-self-photo" && aiGenerateLimit > 0 ? (
                  <div className="pill pill--ai-quota">AI ×{aiGenerateLimit}</div>
                ) : null}
                {captureCount > 0 && (
                  <div className="pill pill--shots">{captureCount} foto</div>
                )}
              </div>
            </header>
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
                isAiPackage ? " preview-video-wrapper--ai-theme" : ""
              }${isCapturing ? " preview-video-wrapper--countdown" : ""}`}
              style={videoWrapperStyle}
            >
              <video
                className="preview-video"
                ref={videoRef}
                playsInline
                muted
              />
              {isAiPackage && aiThemePreviewUrl && !showAiIntro ? (
                <div className="ai-theme-watermark" aria-hidden="true">
                  <img src={aiThemePreviewUrl} alt="" />
                  <span>{aiThemeLabel ?? "AI"}</span>
                </div>
              ) : null}
            </div>
          )}

          {isReviewing && lastImageUrl && (
            <div
              className="capture-overlay capture-overlay--review"
              key={`review-${shotStamp}`}
            >
              <img
                src={lastImageUrl}
                alt="Foto terakhir"
                className="capture-review-image"
              />
              <div className="capture-review-badge">Hasil foto</div>
              {lastImageProcessing && (
                <div className="processing-overlay">
                  <div className="processing-spinner" />
                  <div className="processing-overlay-hint">
                    Sedikit sabar — hasilnya worth it
                  </div>
                </div>
              )}
              <div className="capture-review-caption">
                {isAiPackage && !lastImageProcessing
                  ? reviewCaption
                  : processingMessage || reviewCaption}
              </div>
            </div>
          )}

          {!isReviewing && !isWaitingCapture && lastImageUrl && (
            <div
              className={`last-shot-thumb${lastImageProcessing ? " last-shot-thumb--processing" : ""}`}
            >
              <img
                src={lastImageUrl}
                alt="Foto terakhir"
              />
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
            <footer className="preview-toolbar">
              <p className="preview-hint">{footerHint}</p>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  className="primary-button preview-capture-button"
                  onClick={startCaptureCountdown}
                  disabled={isCapturing || isReviewing || !sessionUser}
                >
                  {isCapturing ? "Mengambil…" : "Ambil Foto (Dev)"}
                </button>
              )}
            </footer>
          )}
          </div>
        </div>
        {import.meta.env.DEV && (
          <div className="dev-badge dev-badge--overlay" title="Development mode">
            Dev · Webcam
          </div>
        )}
      </div>
    );
  }

  if (screen === Screen.END) {
    const isAiPackage = endedPackageType === "ai-self-photo";
    return (
      <div className="screen screen--idle screen--end">
        <div className="idle-content">
          <div className="idle-badge idle-badge--success">Sesi selesai</div>
          <h1 className="headline">Terima kasih</h1>
          <p className="subheadline">
            Foto Anda sudah tersimpan.
            <br />
            {isAiPackage ? (
              <>
                Ke meja operator · pilih foto · lihat hasil
                {endedAiThemeLabel ? ` ${endedAiThemeLabel}` : ""}
                {endedAiGenerateLimit > 0 ? ` · kuota ${endedAiGenerateLimit}×` : ""}.
              </>
            ) : (
              <>Silakan hubungi tim studio bila ingin melihat atau mencetak.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--idle">
      <div className="idle-content">
        <div className="idle-logo-wrap">
          <img src="./logo-light.png" className="idle-logo" alt="Sudut Pandang" />
        </div>
        <div className="idle-badge">Self Photo Studio</div>
        <p className="idle-subtitle">Menunggu sesi dari operator…</p>
      </div>
    </div>
  );
}
