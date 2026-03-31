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
      const now = Date.now();
      const remaining = endsAt - now;

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;

        setRemainingMs(0);
        warnedRef.current = false;
        onExpire?.();
        return;
      }

      if (!warnedRef.current && remaining <= 60000) {
        warnedRef.current = true;
        onWarn?.();
      }

      setRemainingMs(remaining);
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [endsAt, onExpire, onWarn]);

  function startWithEndsAt(serverEndsAt) {
    setEndsAt(serverEndsAt);
    setRemainingMs(Math.max(0, serverEndsAt - Date.now()));
    warnedRef.current = false;
  }

  function start(durationOverride) {
    const base =
      typeof durationOverride === "number"
        ? durationOverride
        : durationMs;

    const nextEndsAt = Date.now() + base;
    startWithEndsAt(nextEndsAt);
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
    startWithEndsAt,
    start,
    clear,
  };
}