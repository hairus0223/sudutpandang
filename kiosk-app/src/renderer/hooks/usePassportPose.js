import { useEffect, useState } from "react";
import {
  mapVideoPointToOverlay,
  scorePassportPose,
} from "../lib/passportPose.js";

const IDLE = {
  ok: false,
  hint: "Masukkan kepala & bahu ke siluet",
  code: "idle",
};

export function usePassportPose(videoRef, overlayRef, enabled) {
  const [pose, setPose] = useState(IDLE);

  useEffect(() => {
    if (!enabled) {
      setPose(IDLE);
      return undefined;
    }

    let cancelled = false;
    let timer = 0;
    let detector = null;

    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        detector = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 1,
        });
      } catch {
        detector = null;
      }
    }

    async function tick() {
      const video = videoRef?.current;
      const overlay = overlayRef?.current;
      if (
        !cancelled &&
        detector &&
        video &&
        overlay &&
        video.readyState >= 2 &&
        video.videoWidth > 0
      ) {
        try {
          const faces = await detector.detect(video);
          const box = faces[0]?.boundingBox;
          if (!box) {
            setPose(scorePassportPose(null));
          } else {
            const tl = mapVideoPointToOverlay(video, overlay, box.x, box.y);
            const br = mapVideoPointToOverlay(
              video,
              overlay,
              box.x + box.width,
              box.y + box.height
            );
            const w = Math.abs(br.x - tl.x);
            const h = Math.abs(br.y - tl.y);
            setPose(
              scorePassportPose({
                cx: (tl.x + br.x) / 2,
                cy: (tl.y + br.y) / 2,
                w,
                h,
              })
            );
          }
        } catch {
          setPose((prev) => prev);
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, 140);
    }

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, overlayRef, videoRef]);

  return pose;
}
