// utils/exportCanvasPrint.ts
import { draw4RLayout } from "@/components/print/canvas/draw4Rlayout";
import { loadBrandingLogo } from "@/utils/loadBrandingLogo";
import { PhotoTransform } from "@/stores/useGalleryStore";
import { FaceBox } from "./faceDetect";
import { drawFull4RLayout } from "@/components/print/canvas/drawFull4RLayout";
import { PrintTemplate } from "@/lib/printTemplates";

export type ImageData = {
  filename: string;
  url: string;
};

/**
 * Export array of ImageData ke canvas PNG (offscreen)
 * Tidak menambahkan border slot aktif
 */
export async function exportCanvasPrint(
  images: ImageData[],
  width: number,
  height: number,
  transforms: Record<string, PhotoTransform>,
  faceBoxes: Record<string, FaceBox[]>,
  printTemplateId: PrintTemplate["id"]
): Promise<string[]> {
  const results: string[] = [];

  const imagesPerPage = printTemplateId === "4R_FULL" ? 1 : 2;

  // 🔥 SPLIT PER PAGE
  for (let page = 0; page < images.length; page += imagesPerPage) {
    const chunk = images.slice(page, page + imagesPerPage);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    // background putih
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // load image fresh (NO CACHE)
    const loadedImages = await Promise.all(
      chunk.map(
        (img) =>
          new Promise<{ img: HTMLImageElement; filename: string }>((res) => {
            const i = new Image();
            i.crossOrigin = "anonymous";
            i.src = `${img.url}?print=${Date.now()}`; // 🔥 cache bust
            i.onload = () => res({ img: i, filename: img.filename });
          })
      )
    );

    const logo = await loadBrandingLogo();

    if (printTemplateId === "4R_FULL") {
      drawFull4RLayout(ctx, loadedImages[0], transforms, faceBoxes);
    } else {
      draw4RLayout(ctx, loadedImages, logo, transforms, faceBoxes);
    }

    results.push(canvas.toDataURL("image/png", 1.0));
  }

  return results;
}

