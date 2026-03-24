import { PhotoTransform } from "@/stores/useGalleryStore";
import { drawSmartCover } from "./drawSmartCover";
import { drawFooterBranding } from "./drawFooterBranding";
import { FaceBox } from "@/utils/faceDetect";

export function draw4RLayout(
  ctx: CanvasRenderingContext2D,
  images: { img: HTMLImageElement; filename: string }[],
  logo: HTMLImageElement,
  transforms: Record<string, PhotoTransform>,
  faceBoxes: Record<string, FaceBox[]>,
) {
  const pad = 0;
  const gap = 70;
  const footerHeight = 130;

  const slotWidth = (ctx.canvas.width - pad * 2 - gap) / 2;
  const slotHeight = ctx.canvas.height - pad * 2;

  images.forEach(({ img, filename }, i) => {
    const x = pad + i * (slotWidth + gap);
    const y = pad;

    drawSmartCover(
      ctx,
      img,
      x,
      y,
      slotWidth,
      slotHeight - footerHeight,
      {
        ...transforms[filename],
        faces: faceBoxes?.[filename],
      }
    );

    drawFooterBranding(ctx, {
      x,
      y,
      width: slotWidth,
      height: slotHeight,
      logo,
      logoHeightRatio: 0.48,
    });
  });
}
