/** Head-and-shoulders bust in a 3×4 frame (viewBox 300×400). */
export const PASSPORT_BUST_PATH =
  "M150 28 C198 28 240 72 240 128 C240 172 220 202 196 224 C184 234 176 242 174 254 C214 262 250 282 270 316 C286 344 294 372 296 400 L4 400 C6 372 14 344 30 316 C50 282 86 262 126 254 C124 242 116 234 104 224 C80 202 60 172 60 128 C60 72 102 28 150 28 Z";

export const PASSPORT_TARGET = {
  headCx: 0.5,
  headCy: 0.355,
  headW: 0.6,
  headH: 0.5,
  eyeY: 0.345,
};

function parseObjectPosition(value) {
  const parts = String(value || "50% 50%").trim().split(/\s+/);
  const toUnit = (token, fallback) => {
    if (!token) return fallback;
    if (token === "center") return 0.5;
    if (token === "left" || token === "top") return 0;
    if (token === "right" || token === "bottom") return 1;
    const n = parseFloat(token);
    return Number.isFinite(n) ? n / 100 : fallback;
  };
  return { x: toUnit(parts[0], 0.5), y: toUnit(parts[1], toUnit(parts[0], 0.5)) };
}

/**
 * Map a point in video intrinsic pixels into an overlay element (0–1).
 * Assumes the video uses object-fit: cover.
 */
export function mapVideoPointToOverlay(video, overlayEl, x, y) {
  const vRect = video.getBoundingClientRect();
  const oRect = overlayEl.getBoundingClientRect();
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = Math.max(vRect.width / vw, vRect.height / vh);
  const extraX = vw * scale - vRect.width;
  const extraY = vh * scale - vRect.height;
  const pos = parseObjectPosition(
    typeof window !== "undefined"
      ? window.getComputedStyle(video).objectPosition
      : "50% 50%"
  );
  const originX = vRect.left - extraX * pos.x;
  const originY = vRect.top - extraY * pos.y;
  return {
    x: (originX + x * scale - oRect.left) / Math.max(1, oRect.width),
    y: (originY + y * scale - oRect.top) / Math.max(1, oRect.height),
  };
}

export function scorePassportPose(face) {
  if (!face) {
    return {
      ok: false,
      hint: "Hadap kamera — wajah belum terlihat",
      code: "no-face",
    };
  }

  const dx = face.cx - PASSPORT_TARGET.headCx;
  const eyeY = face.cy - face.h * 0.1;
  const dyEyes = eyeY - PASSPORT_TARGET.eyeY;
  const sizeRatio = face.h / PASSPORT_TARGET.headH;

  if (Math.abs(dx) > 0.09) {
    return {
      ok: false,
      hint: dx > 0 ? "Geser sedikit ke kiri" : "Geser sedikit ke kanan",
      code: "x",
    };
  }
  if (sizeRatio < 0.78) {
    return { ok: false, hint: "Maju mendekati kamera", code: "far" };
  }
  if (sizeRatio > 1.24) {
    return { ok: false, hint: "Mundur sedikit dari kamera", code: "close" };
  }
  if (dyEyes > 0.06) {
    return { ok: false, hint: "Naikkan posisi kepala", code: "low" };
  }
  if (dyEyes < -0.06) {
    return { ok: false, hint: "Turunkan dagu sedikit", code: "high" };
  }
  return { ok: true, hint: "Posisi tepat — siap foto", code: "ok" };
}
