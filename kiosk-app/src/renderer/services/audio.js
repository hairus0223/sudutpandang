import { useMemo, useCallback, useRef } from "react";

/**
 * Procedural capture SFX via Web Audio — independent of silent-shutter cameras.
 * Voice prompts still use MP3 assets under /audio/.
 */
function createCaptureSynth() {
  let ctx = null;
  let master = null;

  function getCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }

  function getMaster() {
    const c = getCtx();
    if (!c) return null;
    if (!master) {
      master = c.createGain();
      master.gain.value = 1;
      master.connect(c.destination);
    }
    return master;
  }

  function playTone({
    frequency,
    duration = 0.16,
    type = "sine",
    peak = 0.55,
    startAt = 0,
    attack = 0.01,
  }) {
    const c = getCtx();
    const dest = getMaster();
    if (!c || !dest) return;
    const now = c.currentTime + startAt;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function playNoiseBurst({
    duration = 0.05,
    peak = 0.7,
    startAt = 0,
    filterFreq = 2200,
    filterType = "bandpass",
  }) {
    const c = getCtx();
    const dest = getMaster();
    if (!c || !dest) return;
    const now = c.currentTime + startAt;
    const length = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(0.75, now);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + duration + 0.03);
  }

  /**
   * Soft photobooth “pip” — warm sine (not harsh square).
   * Clear on TV speakers; pitch rises toward the last second.
   */
  function beep(remainingSeconds = 3) {
    const remaining = Number(remainingSeconds || 0);
    const freq = remaining <= 1 ? 1318 : remaining <= 2 ? 1046 : 880;

    playTone({
      frequency: freq,
      duration: 0.22,
      type: "sine",
      peak: 0.9,
      attack: 0.003,
    });
    playTone({
      frequency: freq * 2,
      duration: 0.14,
      type: "sine",
      peak: 0.28,
      startAt: 0.012,
      attack: 0.004,
    });

    if (remaining <= 1) {
      playTone({
        frequency: 1568,
        duration: 0.26,
        type: "sine",
        peak: 0.95,
        startAt: 0.14,
        attack: 0.003,
      });
    }
  }

  /** Punchy digital shutter for silent cameras. */
  function shutter() {
    playTone({ frequency: 140, duration: 0.05, type: "square", peak: 0.7 });
    playNoiseBurst({
      duration: 0.07,
      peak: 0.95,
      startAt: 0.012,
      filterFreq: 3200,
    });
    playTone({
      frequency: 880,
      duration: 0.09,
      type: "triangle",
      peak: 0.55,
      startAt: 0.025,
    });
    playNoiseBurst({
      duration: 0.12,
      peak: 0.45,
      startAt: 0.05,
      filterFreq: 700,
      filterType: "lowpass",
    });
    playTone({
      frequency: 220,
      duration: 0.08,
      type: "sine",
      peak: 0.4,
      startAt: 0.06,
    });
  }

  /** Clear confirm when review photo appears. */
  function captureSuccess() {
    playTone({ frequency: 523.25, duration: 0.14, type: "sine", peak: 0.55 });
    playTone({
      frequency: 659.25,
      duration: 0.2,
      type: "sine",
      peak: 0.6,
      startAt: 0.08,
    });
    playTone({
      frequency: 783.99,
      duration: 0.28,
      type: "sine",
      peak: 0.5,
      startAt: 0.16,
    });
  }

  function unlock() {
    getCtx();
    getMaster();
  }

  return { beep, shutter, captureSuccess, unlock };
}

export function useKioskAudio() {
  const synthRef = useRef(null);
  if (!synthRef.current) {
    synthRef.current = createCaptureSynth();
  }

  const sounds = useMemo(() => {
    const assetUrl = (relativePath) =>
      new URL(relativePath, document.baseURI).toString();
    const map = {
      timeWarning: new Audio(assetUrl("./audio/time-warning-id.mp3")),
      // Original Indonesian voice — correct session-end UX
      sessionEnd: new Audio(assetUrl("./audio/session-end-id.mp3")),
    };
    Object.values(map).forEach((audio) => {
      audio.volume = 1;
    });
    // Slightly softer so the voice reads warmer on TV speakers
    map.sessionEnd.volume = 0.85;
    return map;
  }, []);

  const play = useCallback(
    (key, options = {}) => {
      const synth = synthRef.current;
      if (key === "beep") {
        synth?.beep(options.remaining ?? options.step ?? 3);
        return;
      }
      if (key === "shutter") {
        synth?.shutter();
        return;
      }
      if (key === "captureSuccess") {
        synth?.captureSuccess();
        return;
      }

      const audio = sounds[key];
      if (!audio) return;
      try {
        if (key !== "sessionEnd") audio.volume = 1;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch {
        // ignore autoplay / missing asset
      }
    },
    [sounds]
  );

  const unlockAudio = useCallback(() => {
    synthRef.current?.unlock();
  }, []);

  return { play, unlockAudio };
}
