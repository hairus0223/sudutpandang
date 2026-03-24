import { useCallback, useRef, useState } from "react";

export function useCameraPreview() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    try {
      // 1. Cari device video (capture card) yang tepat, kalau gagal pakai default
      const baseConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      let constraints = { video: baseConstraints };

      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const capture = devices.find(
          (d) =>
            d.kind === "videoinput" &&
            /hdmi|capture|elgato|usb video/i.test(d.label || "")
        );

        if (capture) {
          constraints = { video: { ...baseConstraints, deviceId: { exact: capture.deviceId } } };
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