import { useMemo, useCallback } from "react";

export function useKioskAudio() {
  const sounds = useMemo(
    () => ({
      welcome: new Audio("/audio/welcome-id.mp3"),
      beep: new Audio("/audio/beep-id.mp3"),
      shutter: new Audio("/audio/shutter-id.mp3"),
      timeWarning: new Audio("/audio/time-warning-id.mp3"),
      sessionEnd: new Audio("/audio/session-end-id.mp3"),
    }),
    []
  );

  const play = useCallback(
    (key) => {
      const audio = sounds[key];
      console.log('test audio', audio)
      if (!audio) return;
      try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    },
    [sounds]
  );

  return { play };
}

