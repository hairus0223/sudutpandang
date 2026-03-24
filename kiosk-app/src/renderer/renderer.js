const API_BASE = "http://192.168.1.10:4000";

// Simple sound manager – drop your own audio files into src/renderer/audio
const sounds = {
  // Sambutan hangat saat mulai sesi
  welcome: new Audio("/audio/welcome-id.mp3"),
  // Beep pendek saat hitung mundur
  beep: new Audio("/audio/beep-id.mp3"),
  // Suara shutter kamera
  shutter: new Audio("/audio/shutter-id.mp3"),
  // Peringatan waktu hampir habis
  timeWarning: new Audio("/audio/time-warning-id.mp3"),
  // Akhir sesi
  sessionEnd: new Audio("/audio/session-end-id.mp3"),
};

function playSound(key) {
  console.log('playSound', key)
  const audio = sounds[key];
  if (!audio) return;
  try {
    audio.currentTime = 0;
    // play() must be triggered by user gesture – all calls we make are from click/interaction flows
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

const Screen = {
  IDLE: "idle",
  REGISTER: "register",
  COUNTDOWN: "countdown",
  PREVIEW: "preview",
  END: "end",
};

let state = {
  screen: Screen.IDLE,
  countdown: 3,
  session: null,
  cameraReady: false,
  currentStream: null,
  captureCount: 0,
  isCapturing: false,
  captureCountdown: 3,
  sessionEndsAt: null,
  remainingMs: null,
  lastImageUrl: null,
};

let sessionTimerInterval = null;

function $(selector) {
  return document.querySelector(selector);
}

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

async function registerCustomer(formData) {
  const payload = {
    name: formData.name,
    phone: formData.phone,
    peopleCount: Number(formData.peopleCount || 1),
    templateId: "4R",
  };

  const res = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Register failed");
  const data = await res.json();
  return data.customer;
}

async function startSession(userSlug, peopleCount) {
  const res = await fetch(`${API_BASE}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userSlug, peopleCount, duration: 10 }),
  });
  if (!res.ok) throw new Error("Session start failed");
  const data = await res.json();
  return data.session;
}

async function stopSession() {
  await fetch(`${API_BASE}/api/session/stop`, {
    method: "POST",
  });
}

async function startCameraPreview() {
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      state.currentStream = stream;
      const video = document.querySelector("video.preview-video");
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    }
    if (window.kiosk?.camera) {
      await window.kiosk.camera.connect();
    }
    setState({ cameraReady: true });
  } catch (err) {
    console.error("Camera preview failed", err);
    setState({ cameraReady: false });
  }
}

function stopCameraPreview() {
  if (state.currentStream) {
    state.currentStream.getTracks().forEach((t) => t.stop());
    state.currentStream = null;
  }
  setState({ cameraReady: false });
}

async function handleCapture() {
  if (!state.session) return;
  const userSlug = state.session.user;

  // The API backend already uses a BASE_DIR + today + userSlug convention.
  // Here we only trigger camera capture; actual download/move should be implemented in main process.
  if (window.kiosk?.camera) {
    await window.kiosk.camera.capture({
      userSlug,
      // targetFolder is informational; your main process implementation can use this when calling vendor tools.
      targetFolderHint: `/SudutPandangStudio/<today>/${userSlug}`,
    });
  }
  setState({ captureCount: state.captureCount + 1 });
  // After capture, try to fetch latest image from API for preview
  setTimeout(() => {
    refreshLatestImage(userSlug);
  }, 1500);
}

function startCaptureCountdown() {
  if (state.isCapturing || !state.session) return;
  setState({ isCapturing: true, captureCountdown: 3 });

  let localCount = 3;
  const timer = setInterval(async () => {
    if (localCount <= 1) {
      clearInterval(timer);
      playSound("shutter");
      await handleCapture();
      setState({ isCapturing: false });
      return;
    }
    localCount -= 1;
    playSound("beep");
    setState({ captureCountdown: localCount });
  }, 1000);
}

function startSessionTimer(endsAt) {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  sessionTimerInterval = setInterval(() => {
    if (!state.session || !state.sessionEndsAt) {
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
      return;
    }
    const remaining = state.sessionEndsAt - Date.now();
    if (remaining <= 0) {
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
      playSound("sessionEnd");
      // Auto-stop session and go to end screen
      stopCameraPreview();
      stopSession().catch(() => {});
      setState({ session: null, remainingMs: 0, screen: Screen.END });
      return;
    }
    // Warning sound when 1 menit tersisa
    if (remaining <= 60_000 && (!state.remainingMs || state.remainingMs > 60_000)) {
      playSound("timeWarning");
    }
    setState({ remainingMs: remaining });
  }, 1000);
}

function clearSessionTimer() {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }
}

async function refreshLatestImage(userSlug) {
  try {
    const res = await fetch(`${API_BASE}/api/images/${encodeURIComponent(userSlug)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.images) && data.images.length > 0) {
      const last = data.images[data.images.length - 1];
      setState({ lastImageUrl: last.url });
    }
  } catch {
    // ignore network errors
  }
}

function countdownAndGoToPreview() {
  setState({ screen: Screen.COUNTDOWN, countdown: 3 });

  const timer = setInterval(() => {
    if (state.countdown <= 1) {
      clearInterval(timer);
      setState({ screen: Screen.PREVIEW });
      startCameraPreview();
      return;
    }
    setState({ countdown: state.countdown - 1 });
  }, 1000);
}

function renderIdle() {
  return `
    <div class="screen screen--idle">
      <div class="pill">Self Photo Session</div>
      <div class="headline">Sudut Pandang Studio</div>
      <p class="subheadline">
        Tap to start your session. We&apos;ll guide you through a calm,
        fully automated shooting experience.
      </p>
      <button class="primary-button" id="btn-start">
        Start Session
      </button>
    </div>
  `;
}

function renderRegister() {
  return `
    <div class="screen screen--idle">
      <div class="headline">Who&apos;s in the frame?</div>
      <p class="subheadline">
        We use your name to organize photos and prints for this session.
      </p>
      <form id="register-form" style="display:flex;flex-direction:column;align-items:center;gap:1.25rem;">
        <div class="form-row">
          <label class="form-label">Name</label>
          <input class="form-input" name="name" required autocomplete="off" />
        </div>
        <div class="form-row">
          <label class="form-label">Phone (optional)</label>
          <input class="form-input" name="phone" autocomplete="off" />
        </div>
        <div class="form-row">
          <label class="form-label">People in frame</label>
          <input class="form-input" name="peopleCount" type="number" min="1" max="8" value="1" />
        </div>
        <div style="display:flex;gap:1rem;margin-top:1.5rem;">
          <button type="button" class="secondary-button" id="btn-register-back">Back</button>
          <button type="submit" class="primary-button">Continue</button>
        </div>
      </form>
    </div>
  `;
}

function renderCountdown() {
  return `
    <div class="screen screen--countdown">
      <div class="pill">Get ready</div>
      <div class="headline">Session starting</div>
      <div class="countdown-number">${state.countdown}</div>
      <p class="subheadline">
        Look into the camera. We&apos;ll start the live preview and capture when you&apos;re ready.
      </p>
    </div>
  `;
}

function renderPreview() {
  const videoMarkup = `
    <video class="preview-video" playsinline muted></video>
  `;

  const remainingLabel = (() => {
    if (!state.remainingMs) return "10:00";
    const totalSeconds = Math.max(0, Math.floor(state.remainingMs / 1000));
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  })();

  return `
    <div class="screen screen--preview">
      <div style="display:flex;justify-content:space-between;width:100%;max-width:72rem;align-items:center;gap:1rem;flex-wrap:wrap;">
        <div class="headline" style="font-size:2rem;text-align:left;">Live Preview</div>
        <div class="session-meta">
          <div class="pill">Session: ${state.session?.user ?? "-"}</div>
          <div class="pill">Shots: ${state.captureCount}</div>
          <div class="pill">Waktu: ${remainingLabel}</div>
        </div>
      </div>

      <div class="preview-wrapper">
        ${videoMarkup}
        ${
          state.isCapturing
            ? `<div class="capture-overlay"><div class="capture-overlay-number">${state.captureCountdown}</div></div>`
            : ""
        }
        ${
          state.lastImageUrl
            ? `<div class="last-shot-thumb">
                 <img src="${state.lastImageUrl}" alt="Foto terakhir" />
                 <div class="last-shot-label">Foto terakhir</div>
               </div>`
            : ""
        }
      </div>

      <div class="toolbar">
        <button class="secondary-button secondary-button--danger" id="btn-end-session">End Session</button>
        <button class="primary-button" id="btn-capture">Capture</button>
      </div>
    </div>
  `;
}

function renderEnd() {
  return `
    <div class="screen screen--idle">
      <div class="headline">Thank you</div>
      <p class="subheadline">
        Your photos are being prepared. Please speak with the studio team
        if you&apos;d like to review or print more.
      </p>
      <button class="primary-button" id="btn-back-to-idle">Back to Idle</button>
    </div>
  `;
}

function render() {
  const root = document.getElementById("app");
  if (!root) return;

  let html = "";
  switch (state.screen) {
    case Screen.IDLE:
      html = renderIdle();
      break;
    case Screen.REGISTER:
      html = renderRegister();
      break;
    case Screen.COUNTDOWN:
      html = renderCountdown();
      break;
    case Screen.PREVIEW:
      html = renderPreview();
      break;
    case Screen.END:
      html = renderEnd();
      break;
    default:
      html = renderIdle();
  }

  root.innerHTML = html;
  bindEvents();
}

function bindEvents() {
  const btnStart = $("#btn-start");
  if (btnStart) {
    btnStart.addEventListener("click", () => {
      playSound("welcome");
      setState({ screen: Screen.REGISTER });
    });
  }

  const btnRegisterBack = $("#btn-register-back");
  if (btnRegisterBack) {
    btnRegisterBack.addEventListener("click", () => {
      setState({ screen: Screen.IDLE });
    });
  }

  const form = $("#register-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const name = formData.get("name")?.toString().trim();
      if (!name) return;

      const payload = {
        name,
        phone: formData.get("phone")?.toString().trim() ?? "",
        peopleCount: formData.get("peopleCount")?.toString().trim() ?? "1",
      };

      try {
        const customer = await registerCustomer(payload);
        const session = await startSession(customer.user, customer.peopleCount);
        const endsAt = Date.now() + 10 * 60 * 1000;
        setState({ session, captureCount: 0, sessionEndsAt: endsAt, remainingMs: endsAt - Date.now() });
        startSessionTimer(endsAt);
        countdownAndGoToPreview();
      } catch (err) {
        console.error(err);
        alert("Unable to start session. Please call staff.");
      }
    });
  }

  const btnCapture = $("#btn-capture");
  if (btnCapture) {
    btnCapture.addEventListener("click", () => {
      startCaptureCountdown();
    });
  }

  const btnEndSession = $("#btn-end-session");
  if (btnEndSession) {
    btnEndSession.addEventListener("click", async () => {
      try {
        await stopSession();
      } catch (err) {
        console.error(err);
      }
      stopCameraPreview();
      clearSessionTimer();
      playSound("sessionEnd");
      setState({ session: null, screen: Screen.END, remainingMs: null, sessionEndsAt: null });
    });
  }

  const btnBackToIdle = $("#btn-back-to-idle");
  if (btnBackToIdle) {
    btnBackToIdle.addEventListener("click", () => {
      clearSessionTimer();
      setState({
        screen: Screen.IDLE,
        session: null,
        captureCount: 0,
        remainingMs: null,
        sessionEndsAt: null,
        lastImageUrl: null,
      });
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  render();
});

