/** Indonesian 3×4: crown≈8%, chin≈73%, eyes≈35% of frame. */

export const PASSPORT_TARGET = {
  headCx: 0.5,
  headCy: 0.405,
  headW: 0.58,
  headH: 0.64,
  eyeY: 0.355,
  chinY: 0.725,
};

/**
 * FaceDetector box is roughly brows→chin. Expand to crown+hair for pas-foto.
 */
export function faceBoxToHead(face) {
  const chin = face.cy + face.h * 0.5;
  const headH = face.h * 1.42;
  const headW = face.w * 1.18;
  const crown = chin - headH;
  return {
    cx: face.cx,
    cy: (crown + chin) / 2,
    w: headW,
    h: headH,
    eyeY: face.cy - face.h * 0.06,
    chinY: chin,
  };
}

export function lerpPose(prev, next, t = 0.38) {
  if (!next) return prev;
  if (!prev) return next;
  return {
    cx: prev.cx + (next.cx - prev.cx) * t,
    cy: prev.cy + (next.cy - prev.cy) * t,
    w: prev.w + (next.w - prev.w) * t,
    h: prev.h + (next.h - prev.h) * t,
    eyeY: prev.eyeY + (next.eyeY - prev.eyeY) * t,
    chinY: prev.chinY + (next.chinY - prev.chinY) * t,
  };
}

export function scorePassportPose(head, wasOk = false) {
  if (!head) {
    return {
      ok: false,
      match: 0,
      hint: "Hadap kamera",
      code: "no-face",
      dx: 0,
      dy: 0,
      size: 0,
    };
  }

  const dx = head.cx - PASSPORT_TARGET.headCx;
  const dyEyes = head.eyeY - PASSPORT_TARGET.eyeY;
  const sizeRatio = head.h / PASSPORT_TARGET.headH;
  const sizeErr = sizeRatio - 1;

  const absX = Math.abs(dx);
  const absY = Math.abs(dyEyes);
  const absS = Math.abs(sizeErr);

  const loose = wasOk;
  const xLim = loose ? 0.12 : 0.09;
  const yLim = loose ? 0.08 : 0.055;
  const sLo = loose ? 0.74 : 0.8;
  const sHi = loose ? 1.34 : 1.2;

  let match = 100;
  match -= Math.min(36, absX * 240);
  match -= Math.min(32, absY * 280);
  match -= Math.min(28, absS * 80);
  match = Math.max(0, Math.round(match));

  const issues = [];
  if (absX > xLim) {
    issues.push({
      code: dx > 0 ? "right" : "left",
      hint: dx > 0 ? "Geser sedikit ke kiri" : "Geser sedikit ke kanan",
      weight: absX,
    });
  }
  if (sizeRatio < sLo) {
    issues.push({
      code: "far",
      hint: "Maju sedikit",
      weight: sLo - sizeRatio,
    });
  } else if (sizeRatio > sHi) {
    issues.push({
      code: "close",
      hint: "Mundur sedikit",
      weight: sizeRatio - sHi,
    });
  }
  if (absY > yLim) {
    issues.push({
      code: dyEyes > 0 ? "low" : "high",
      hint: dyEyes > 0 ? "Naikkan sedikit" : "Turunkan sedikit",
      weight: absY,
    });
  }

  issues.sort((a, b) => b.weight - a.weight);
  const worst = issues[0];

  if (!worst) {
    return {
      ok: true,
      match: Math.max(match, 86),
      hint: "Pas — siap foto",
      code: "ok",
      dx,
      dy: dyEyes,
      size: sizeRatio,
    };
  }

  return {
    ok: false,
    match,
    hint: worst.hint,
    code: worst.code,
    dx,
    dy: dyEyes,
    size: sizeRatio,
  };
}

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
