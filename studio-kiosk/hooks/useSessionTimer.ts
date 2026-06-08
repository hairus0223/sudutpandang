import { useEffect, useRef, useState } from "react";

type SyncPayload = {
  endsAt?: number | null;
  pausedAt?: number | null | boolean;
  remainingMs?: number | null;
};

type UseSessionTimerOptions = {
  durationMs: number;
  onExpire?: () => void;
  onWarn?: () => void;
};

export function useSessionTimer({
  durationMs,
  onExpire,
  onWarn,
}: UseSessionTimerOptions) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!endsAt || isPaused) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const remaining = endsAt - Date.now();

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
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
  }, [endsAt, isPaused, onExpire, onWarn]);

  function stopInterval() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function syncFromServer({
    endsAt: serverEndsAt,
    pausedAt,
    remainingMs: serverRemainingMs,
  }: SyncPayload = {}) {
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
      warnedRef.current = false;
    } else if (serverRemainingMs != null) {
      setRemainingMs(serverRemainingMs);
    }
  }

  function startWithEndsAt(serverEndsAt: number) {
    setIsPaused(false);
    setEndsAt(serverEndsAt);
    setRemainingMs(Math.max(0, serverEndsAt - Date.now()));
    warnedRef.current = false;
  }

  function start(durationOverride?: number) {
    const base =
      typeof durationOverride === "number" ? durationOverride : durationMs;

    startWithEndsAt(Date.now() + base);
  }

  function clear() {
    stopInterval();
    setEndsAt(null);
    setIsPaused(false);
    setRemainingMs(durationMs);
    warnedRef.current = false;
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
