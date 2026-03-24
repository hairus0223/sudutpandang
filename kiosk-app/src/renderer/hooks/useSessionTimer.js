import { useEffect, useRef, useState } from "react";

export function useSessionTimer({ durationMs, onExpire, onWarn }) {
  const [endsAt, setEndsAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const timerRef = useRef(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!endsAt) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = endsAt - Date.now();
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setRemainingMs(0);
        warnedRef.current = false;
        onExpire?.();
        return;
      }
      if (!warnedRef.current && remaining <= 60_000) {
        warnedRef.current = true;
        onWarn?.();
      }
      setRemainingMs(remaining);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [endsAt, onExpire, onWarn]);

  function start(customDurationMs) {
    const base = typeof customDurationMs === "number" ? customDurationMs : durationMs;
    const nextEndsAt = Date.now() + base;
    setEndsAt(nextEndsAt);
    setRemainingMs(base);
    warnedRef.current = false;
  }

  function clear() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setEndsAt(null);
    setRemainingMs(durationMs);
    warnedRef.current = false;
  }

  return {
    remainingMs,
    start,
    clear,
  };
}

