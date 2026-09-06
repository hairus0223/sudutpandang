export const PASSPORT_BUST_PATH =
  "M150 28 C198 28 240 72 240 128 C240 172 220 202 196 224 C184 234 176 242 174 254 C214 262 250 282 270 316 C286 344 294 372 296 400 L4 400 C6 372 14 344 30 316 C50 282 86 262 126 254 C124 242 116 234 104 224 C80 202 60 172 60 128 C60 72 102 28 150 28 Z";

export const PASSPORT_TARGET = {
  headCx: 0.5,
  headCy: 0.355,
  headW: 0.6,
  headH: 0.5,
  eyeY: 0.345,
};

export type PassportPose = {
  ok: boolean;
  hint: string;
  code: string;
};

export function scorePassportPose(face: {
  cx: number;
  cy: number;
  w: number;
  h: number;
} | null): PassportPose {
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
