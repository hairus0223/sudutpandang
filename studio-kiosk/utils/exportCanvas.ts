// utils/exportCanvasPrint.ts
import { draw4RLayout } from "@/components/print/canvas/draw4Rlayout";
import { loadBrandingLogo } from "@/utils/loadBrandingLogo";
import { PhotoTransform } from "@/stores/useGalleryStore";
import { FaceBox } from "./faceDetect";
import { drawFull4RLayout } from "@/components/print/canvas/drawFull4RLayout";
import { PrintTemplate } from "@/lib/printTemplates";
import type { SheetRecipe } from "@/lib/sheetRecipe";
import { getPaperPreset } from "@/lib/paperSizes";
import { drawSheetLayout } from "@/components/print/canvas/drawSheetLayout";
import type { SheetBindingMode } from "@/lib/sheetSlotBinding";
import { buildSheetSlotDraws } from "@/utils/sheetRender";
import {
  packSheetRecipe,
  type SheetGridAlign,
} from "@/utils/sheetLayoutEngine";

export type ImageData = {
  filename: string;
  url: string;
};

/** Pastikan tidak ada pixel transparan — aman untuk PDF/cetak. */
function flattenCanvasAlpha(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
}

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

    flattenCanvasAlpha(ctx, width, height);
    results.push(canvas.toDataURL("image/png", 1.0));
  }

  return results;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${url}${url.includes("?") ? "&" : "?"}print=${Date.now()}`;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for sheet export"));
  });
}

/**
 * Export full paper sheet PNG(s) for sheet print mode.
 */
export async function exportSheetPrint({
  images,
  recipe,
  transforms,
  sheetSlotTransforms,
  faceBoxes,
  bindingMode = "cycle",
  sizeAssignments = {},
  slotAssignments = {},
  includeCutLines = false,
  copies = 1,
  align = "top-left",
}: {
  images: ImageData[];
  recipe: SheetRecipe;
  transforms: Record<string, PhotoTransform>;
  sheetSlotTransforms: Record<number, PhotoTransform>;
  faceBoxes: Record<string, FaceBox[]>;
  bindingMode?: SheetBindingMode;
  sizeAssignments?: Record<string, string>;
  slotAssignments?: Record<number, string>;
  includeCutLines?: boolean;
  copies?: number;
  align?: SheetGridAlign;
}): Promise<string[]> {
  if (!images.length) return [];

  const paper = getPaperPreset(recipe.paperId);
  const geometry = packSheetRecipe(recipe, paper, align);

  const loaded = await Promise.all(
    images.map(async (img) => ({
      filename: img.filename,
      element: await loadImageElement(img.url),
    }))
  );

  const results: string[] = [];
  const sheetCopies = Math.max(1, Math.min(10, copies));

  for (let copy = 0; copy < sheetCopies; copy += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = geometry.paperWidthPx;
    canvas.height = geometry.paperHeightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const slotDraws = buildSheetSlotDraws({
      geometry,
      images,
      loaded: loaded.map((entry) => ({
        filename: entry.filename,
        img: entry.element,
      })),
      bindingMode,
      sizeAssignments,
      slotAssignments,
      photoTransforms: transforms,
      sheetSlotTransforms,
      faceBoxes,
    });

    drawSheetLayout(ctx, {
      slots: geometry.slots,
      slotDraws,
      showCutLines: includeCutLines,
      activeSlotIndex: null,
    });

    flattenCanvasAlpha(ctx, geometry.paperWidthPx, geometry.paperHeightPx);
    results.push(canvas.toDataURL("image/png", 1.0));
  }

  return results;
}

