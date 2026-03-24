import { PhotoFilter } from "@/stores/useGalleryStore";
import { getCanvasFilter } from "@/utils/canvasFilters";
import { FaceBox } from "@/utils/faceDetect";
import { applyFaceSmoothing } from "@/utils/skinSmoothing";
import { applyWeddingToneCurve } from "@/utils/weddingCurve";

export function drawSmartCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  transform?: {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    filter?: PhotoFilter;
    intensity?: number;
    faces?: FaceBox[];
  }
) {
  const scale = transform?.scale ?? 1;
  const offsetX = transform?.offsetX ?? 0;
  const offsetY = transform?.offsetY ?? 0;
  const filter = transform?.filter ?? "none";
  const intensity = transform?.intensity ?? 1;
  const faces = transform?.faces ?? [];

  /* ================== FIT IMAGE ================== */
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let drawW = w;
  let drawH = h;

  if (imgRatio > boxRatio) {
    drawH = h;
    drawW = h * imgRatio;
  } else {
    drawW = w;
    drawH = w / imgRatio;
  }

  drawW *= scale;
  drawH *= scale;

  const dx = x + (w - drawW) / 2 + offsetX;
  const dy = y + (h - drawH) / 2 + offsetY;

  /* ================== CLIP ================== */
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  /* ================== BASE DRAW ================== */
  ctx.filter = getCanvasFilter(filter, intensity);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.filter = "none";

  /* ================== ADVANCED WEDDING PASS ================== */
  // if (filter === "wedding") {
  //   // Skin smoothing (WAJAH ONLY)
  //   if (faces.length > 0) {
  //     applyFaceSmoothing(
  //       ctx,
  //       img,
  //       faces,
  //       scale,
  //       dx,
  //       dy,
  //       intensity
  //     );
  //   }

  //   // Wedding matte tone curve
  //   applyWeddingToneCurve(ctx, x, y, w, h);
  // }

  ctx.restore();
}

export function getCoverSize(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number
) {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;

  let drawW = boxW;
  let drawH = boxH;

  if (imgRatio > boxRatio) {
    drawH = boxH;
    drawW = boxH * imgRatio;
  } else {
    drawW = boxW;
    drawH = boxW / imgRatio;
  }

  return { drawW, drawH };
}
