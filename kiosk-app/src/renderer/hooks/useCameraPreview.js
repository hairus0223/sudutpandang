import { useCallback, useRef, useState } from "react";

export function useCameraPreview() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    try {
      // 1. Cari device video (capture card) yang tepat, kalau gagal pakai default
      const portrait =
        typeof window !== "undefined" && window.innerHeight >= window.innerWidth;
      const baseConstraints = portrait
        ? { width: { ideal: 1080 }, height: { ideal: 1920 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } };
      let constraints = { video: baseConstraints };

      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const preferBuiltin =
          import.meta.env.DEV ||
          import.meta.env.VITE_PREFER_BUILTIN_CAMERA === "true";

        const capture = preferBuiltin
          ? null
          : videoInputs.find((d) =>
              /hdmi|capture|elgato|usb video/i.test(d.label || "")
            );

        const builtin = videoInputs.find((d) =>
          /facetime|built[- ]?in|integrated|isight|webcam/i.test(d.label || "")
        );

        const selected = capture || (preferBuiltin ? builtin : null) || videoInputs[0];

        if (selected?.deviceId) {
          constraints = {
            video: { ...baseConstraints, deviceId: { exact: selected.deviceId } },
          };
        }
      }

      // 2. Minta stream dengan device tersebut
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 3. Opsional: konek ke IPC Electron (Sony dll)
      if (window.kiosk?.camera) {
        await window.kiosk.camera.connect();
      }

      setReady(true);
    } catch (err) {
      console.error("Camera preview failed", err);
      // NotReadableError biasanya artinya device sedang dipakai app lain
      if (err && err.name === "NotReadableError") {
        alert(
          "Kamera / capture card tidak bisa diakses.\n" +
            "Pastikan tidak sedang dipakai aplikasi lain (Zoom, OBS, Imaging Edge live view)."
        );
      }
      setReady(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  }, []);

  return { videoRef, start, stop, ready };
}