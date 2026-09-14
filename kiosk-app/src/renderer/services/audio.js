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
      master.gain.value = 0.72;
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
    const freq = remaining <= 1 ? 988 : remaining <= 2 ? 784 : 659;

    playTone({
      frequency: freq,
      duration: 0.12,
      type: "sine",
      peak: 0.38,
      attack: 0.006,
    });
    playTone({
      frequency: freq * 2,
      duration: 0.08,
      type: "sine",
      peak: 0.1,
      startAt: 0.01,
      attack: 0.008,
    });
  }

  /** Soft shutter click — present, not harsh. */
  function shutter() {
    playTone({
      frequency: 196,
      duration: 0.045,
      type: "sine",
      peak: 0.28,
      attack: 0.002,
    });
    playNoiseBurst({
      duration: 0.04,
      peak: 0.22,
      startAt: 0.008,
      filterFreq: 1800,
    });
    playTone({
      frequency: 523,
      duration: 0.07,
      type: "triangle",
      peak: 0.16,
      startAt: 0.018,
      attack: 0.004,
    });
  }

  /** Short confirm when the photo appears. */
  function captureSuccess() {
    playTone({ frequency: 523.25, duration: 0.09, type: "sine", peak: 0.22, attack: 0.008 });
    playTone({
      frequency: 659.25,
      duration: 0.14,
      type: "sine",
      peak: 0.2,
      startAt: 0.07,
      attack: 0.01,
    });
  }

  /** Session complete: two notes, under 0.7s. */
  function sessionEnd() {
    playTone({
      frequency: 392,
      duration: 0.12,
      type: "sine",
      peak: 0.24,
      attack: 0.01,
    });
    playTone({
      frequency: 523.25,
      duration: 0.22,
      type: "sine",
      peak: 0.26,
      startAt: 0.11,
      attack: 0.012,
    });
    playTone({
      frequency: 659.25,
      duration: 0.18,
      type: "sine",
      peak: 0.14,
      startAt: 0.28,
      attack: 0.02,
    });
  }

  function unlock() {
    getCtx();
    getMaster();
  }

  return { beep, shutter, captureSuccess, sessionEnd, unlock };
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
    };
    Object.values(map).forEach((audio) => {
      audio.volume = 0.85;
    });
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
      if (key === "sessionEnd") {
        synth?.sessionEnd();
        return;
      }

      const audio = sounds[key];
      if (!audio) return;
      try {
        if (key !== "sessionEnd") audio.volume = 0.85;
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
