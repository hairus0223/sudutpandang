import { PhotoTransform } from "@/stores/useGalleryStore";
import { drawSmartCover } from "./drawSmartCover";
import { FaceBox } from "@/utils/faceDetect";

export function drawFull4RLayout(
  ctx: CanvasRenderingContext2D,
  image: { img: HTMLImageElement; filename: string },
  transforms: Record<string, PhotoTransform>,
  faceBoxes: Record<string, FaceBox[]>
) {
  const { img, filename } = image;

  drawSmartCover(
    ctx,
    img,
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height,
    {
      ...transforms[filename],
      faces: faceBoxes?.[filename],
    }
  );
}
