import type { PhotoTransform } from "@/stores/useGalleryStore";
import type { FaceBox } from "@/utils/faceDetect";
import type { SlotRect } from "@/utils/sheetLayoutEngine";
import { drawPassportGuide } from "./drawPassportGuide";
import { drawSmartCover } from "./drawSmartCover";

export type SheetSlotDraw = {
  image: HTMLImageElement;
  transform?: PhotoTransform;
  faceBoxes?: FaceBox[];
};

type DrawSheetLayoutOptions = {
  slots: SlotRect[];
  slotDraws: SheetSlotDraw[];
  showCutLines?: boolean;
  activeSlotIndex?: number | null;
  showPassportGuide?: boolean;
};

export function drawSheetLayout(
  ctx: CanvasRenderingContext2D,
  {
    slots,
    slotDraws,
    showCutLines = true,
    activeSlotIndex = null,
    showPassportGuide = false,
  }: DrawSheetLayoutOptions
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const slot of slots) {
    const draw = slotDraws[slot.index];
    if (!draw) continue;

    drawSmartCover(ctx, draw.image, slot.x, slot.y, slot.w, slot.h, {
      ...draw.transform,
      faces: draw.faceBoxes ?? [],
    });

    if (showCutLines) {
      ctx.save();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.9)";
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(slot.x + 0.5, slot.y + 0.5, slot.w - 1, slot.h - 1);
      ctx.restore();
    }

    if (activeSlotIndex === slot.index) {
      if (showPassportGuide) {
        drawPassportGuide(ctx, slot.x, slot.y, slot.w, slot.h);
      }

      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
      ctx.restore();
    }
  }
}
