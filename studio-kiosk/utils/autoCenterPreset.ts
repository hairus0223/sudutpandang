import { getCoverSize } from "@/components/print/canvas/drawSmartCover";

export type AutoCenterPreset =
  | "portrait"
  | "group"
  | "auto";

export function autoCenterTransform(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  preset: AutoCenterPreset = "auto"
) {
  const { drawW, drawH } = getCoverSize(
    imgW,
    imgH,
    boxW,
    boxH
  );

  let offsetY = 0;

  // =========================
  // AUTO DETECT
  // =========================
  if (preset === "auto") {
    const imgRatio = imgW / imgH;
    const boxRatio = boxW / boxH;

    // portrait photo
    if (imgRatio < boxRatio) {
      offsetY = -(drawH - boxH) * 0.25;
    } else {
      offsetY = 0;
    }
  }

  // =========================
  // MANUAL PRESET
  // =========================
  if (preset === "portrait") {
    offsetY = -(drawH - boxH) * 0.25;
  }

  if (preset === "group") {
    offsetY = 0;
  }

  return {
    scale: 1,
    offsetX: 0,
    offsetY,
  };
}
