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

const PACKAGE_LABELS = {
  "self-photo": "Self Photo",
  "pas-photo": "Pas Photo",
  "ai-photo": "AI Photo",
};

function syncKioskFields(fields, setters) {
  applyKioskSyncFields(setters, fields);
}

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
  const [lastImageProcessing, setLastImageProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [packageType, setPackageType] = useState("self-photo");
  const [passportSizeId, setPassportSizeId] = useState("3x4");
  const [themeId, setThemeId] = useState(null);
  const [themeLabels, setThemeLabels] = useState({});
  const [latestPreviewImage, setLatestPreviewImage] = useState(null);

  const sessionUserRef = useRef(sessionUser);
  const packageTypeRef = useRef(packageType);
  sessionUserRef.current = sessionUser;
  packageTypeRef.current = packageType;

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

  const sessionTimer = useSessionTimer({
    durationMs: kioskConfig.sessionDurationMinutes * 60 * 1000,
    onExpire: () => {
      play("sessionEnd");
      stopCameraPreview();
      cancelPoll();
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
      setSessionUser(user);
      setScreen(Screen.TRIAL);
      setCaptureCount(0);
      setLastImageUrl(null);
      setLastImageProcessing(false);
      setProcessingError(null);
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
      setSessionUser(user);
      setScreen(Screen.MAIN);
      setCaptureCount(0);
      setLastImageUrl(null);
      setLastImageProcessing(false);
      setProcessingError(null);
      syncKioskFields(fields, kioskSetters);
      sessionTimer.startWithEndsAt(endsAt);
      startCameraPreview();
    });

    socket.on("session-ended", () => {
      play("sessionEnd");
      stopCameraPreview();
      cancelPoll();
      sessionTimer.clear();
      setScreen(Screen.END);
      setSessionUser(null);
    });

    socket.on("session-state", ({ activeSession, sessionLocked, timer }) => {
      if (sessionLocked || !timer) return;

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

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCapture() {
    if (!sessionUser) return;
    const userSlug = sessionUser;
    const pkg = packageTypeRef.current;

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

    setCaptureCount((c) => c + 1);
    setProcessingError(null);

    window.setTimeout(async () => {
      const result = await refreshPreview();
      const latest = result?.image;
      const waitingForProcessed =
        pkg === "ai-photo" || pkg === "pas-photo"
          ? latest?.processingStatus !== "ready"
          : false;

      setLastImageProcessing(Boolean(waitingForProcessed));

      if (waitingForProcessed && latest?.imageId) {
        void waitForImageProcessing(latest.imageId);
      }
    }, 1500);
  }

  function startCaptureCountdown() {
    if (isCapturing || isReviewing || !sessionUser) return;
    const total = kioskConfig.captureCountdownSeconds || 3;
    setIsCapturing(true);
    setCaptureCountdown(total);

    let localCount = total;
    const timer = window.setInterval(async () => {
      if (localCount <= 1) {
        window.clearInterval(timer);
        play("shutter");
        await handleCapture();
        setIsCapturing(false);
        setIsReviewing(true);
        window.setTimeout(() => {
          setIsReviewing(false);
          startCameraPreview();
        }, 3000);
        return;
      }
      localCount -= 1;
      play("beep");
      setCaptureCountdown(localCount);
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

          {isCapturing && (
            <div className="capture-overlay">
              <div className="capture-overlay-number">{captureCountdown}</div>
            </div>
          )}

          {!isReviewing && (
            <div className="preview-video-wrapper">
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
            <div className="capture-overlay">
              <img src={lastImageUrl} alt="Foto terakhir" className="preview-video" />
              {lastImageProcessing && (
                <div className="processing-overlay">
                  <div className="processing-spinner" />
                </div>
              )}
              <div className="last-shot-label">
                {processingMessage ||
                  (isAiPhoto
                    ? "Foto AI siap"
                    : "Menampilkan hasil foto… sesi lanjut sebentar lagi")}
              </div>
            </div>
          )}

          {!isReviewing && lastImageUrl && (
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

          <div className="preview-toolbar">
            <div className="pill-big">{remainingLabel}</div>
            <button
              type="button"
              className="primary-button preview-capture-button"
              onClick={startCaptureCountdown}
              disabled={isCapturing || isReviewing || !sessionUser}
            >
              Ambil Foto
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--idle">
      <div className="headline">Terima kasih</div>
      <p className="subheadline">
        Foto Anda sedang diproses.
        <br />
        Silakan hubungi tim studio bila ingin melihat atau mencetak lebih banyak.
      </p>
    </div>
  );
}
