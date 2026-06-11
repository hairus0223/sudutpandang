import { getCoverSize } from "@/components/print/canvas/drawSmartCover";
import type { PhotoTransform } from "@/stores/useGalleryStore";
import type { FaceBox } from "@/utils/faceDetect";
import { autoCenterTransform } from "@/utils/autoCenterPreset";

/**
 * Position a portrait so the primary face sits near standard pas-foto eye line (~38% from top).
 */
export function autoCenterFromFaces(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  faces: FaceBox[]
): PhotoTransform {
  if (!faces.length) {
    return autoCenterTransform(imgW, imgH, boxW, boxH, "portrait");
  }

  const face = faces.reduce((largest, current) =>
    current.w * current.h > largest.w * largest.h ? current : largest
  );

  const { drawW, drawH } = getCoverSize(imgW, imgH, boxW, boxH);
  const scale = 1;

  const faceCenterX = face.x + face.w / 2;
  const faceCenterY = face.y + face.h / 2;

  const targetEyeY = boxH * 0.38;
  const canvasFaceX = (faceCenterX / imgW) * drawW;
  const canvasFaceY = (faceCenterY / imgH) * drawH;

  const offsetX = boxW / 2 - canvasFaceX;
  const offsetY = targetEyeY - canvasFaceY;

  const maxX = Math.max(0, (drawW * scale - boxW) / 2);
  const maxY = Math.max(0, (drawH * scale - boxH) / 2);

  return {
    scale,
    offsetX: Math.min(maxX, Math.max(-maxX, offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, offsetY)),
  };
}
