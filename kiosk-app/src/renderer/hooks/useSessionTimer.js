import { useEffect, useRef, useState } from "react";

export function useSessionTimer({ durationMs, onExpire, onWarn }) {
  const [endsAt, setEndsAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);
  const warnedRef = useRef(false);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const onWarnRef = useRef(onWarn);
  onExpireRef.current = onExpire;
  onWarnRef.current = onWarn;

  useEffect(() => {
    if (!endsAt || isPaused) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const remaining = endsAt - Date.now();

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setRemainingMs(0);
        setEndsAt(null);
        warnedRef.current = false;
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpireRef.current?.();
        }
        return;
      }

      if (!warnedRef.current && remaining <= 60000) {
        warnedRef.current = true;
        onWarnRef.current?.();
      }

      setRemainingMs(remaining);
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [endsAt, isPaused]);

  function stopInterval() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function syncFromServer({ endsAt: serverEndsAt, pausedAt, remainingMs: serverRemainingMs } = {}) {
    if (serverEndsAt != null) setEndsAt(serverEndsAt);

    if (pausedAt) {
      setIsPaused(true);
      if (serverRemainingMs != null) {
        setRemainingMs(serverRemainingMs);
      } else if (serverEndsAt != null) {
        setRemainingMs(Math.max(0, serverEndsAt - Date.now()));
      }
      stopInterval();
      return;
    }

    if (pausedAt === null) {
      setIsPaused(false);
    }

    if (serverEndsAt != null) {
      setRemainingMs(Math.max(0, serverEndsAt - Date.now()));
      if (serverEndsAt > Date.now()) {
        expiredRef.current = false;
      }
      warnedRef.current = false;
    } else if (serverRemainingMs != null) {
      setRemainingMs(serverRemainingMs);
    }
  }

  function startWithEndsAt(serverEndsAt) {
    setIsPaused(false);
    expiredRef.current = false;
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
    stopInterval();
    setEndsAt(null);
    setIsPaused(false);
    setRemainingMs(durationMs);
    warnedRef.current = false;
    expiredRef.current = false;
  }

  return {
    remainingMs,
    isPaused,
    startWithEndsAt,
    start,
    clear,
    syncFromServer,
  };
}
