import { useEffect, useRef, useState } from "react";
import {
  faceBoxToHead,
  lerpPose,
  mapVideoPointToOverlay,
  scorePassportPose,
} from "../lib/passportPose.js";

const IDLE = {
  ok: false,
  match: 0,
  hint: "Cocokkan kepala ke oval",
  code: "idle",
  head: null,
  dx: 0,
  dy: 0,
  size: 0,
};

export function usePassportPose(videoRef, overlayRef, enabled) {
  const [pose, setPose] = useState(IDLE);
  const smoothRef = useRef(null);
  const okRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      smoothRef.current = null;
      okRef.current = false;
      setPose(IDLE);
      return undefined;
    }

    let cancelled = false;
    let timer = 0;
    let detector = null;

    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        detector = new window.FaceDetector({
          fastMode: false,
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
            smoothRef.current = null;
            okRef.current = false;
            setPose(scorePassportPose(null));
          } else {
            const tl = mapVideoPointToOverlay(video, overlay, box.x, box.y);
            const br = mapVideoPointToOverlay(
              video,
              overlay,
              box.x + box.width,
              box.y + box.height
            );
            const raw = faceBoxToHead({
              cx: (tl.x + br.x) / 2,
              cy: (tl.y + br.y) / 2,
              w: Math.abs(br.x - tl.x),
              h: Math.abs(br.y - tl.y),
            });
            const head = lerpPose(smoothRef.current, raw, 0.4);
            smoothRef.current = head;
            const scored = scorePassportPose(head, okRef.current);
            okRef.current = scored.ok;
            setPose({ ...scored, head });
          }
        } catch {
          /* keep last pose */
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, 90);
    }

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, overlayRef, videoRef]);

  return pose;
}
