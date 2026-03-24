import { FaceBox } from "@/utils/faceDetect";

export function applyFaceSmoothing(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  faces: FaceBox[],
  scale: number,
  offsetX: number,
  offsetY: number,
  intensity = 1
) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.35 * intensity;
  ctx.filter = `blur(${6 * intensity}px)`;

  faces.forEach((f) => {
    ctx.drawImage(
      img,
      f.x * scale + offsetX,
      f.y * scale + offsetY,
      f.w * scale,
      f.h * scale
    );
  });

  ctx.restore();
}
