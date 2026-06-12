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

type PrintableArea = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DrawSheetLayoutOptions = {
  slots: SlotRect[];
  slotDraws: SheetSlotDraw[];
  showCutLines?: boolean;
  activeSlotIndex?: number | null;
  selectedSlotIndices?: number[];
  primarySlotIndex?: number | null;
  showPassportGuide?: boolean;
  printableArea?: PrintableArea | null;
  showPrintableGuide?: boolean;
};

export function drawSheetLayout(
  ctx: CanvasRenderingContext2D,
  {
    slots,
    slotDraws,
    showCutLines = true,
    activeSlotIndex = null,
    selectedSlotIndices = [],
    primarySlotIndex = null,
    showPassportGuide = false,
    printableArea = null,
    showPrintableGuide = false,
  }: DrawSheetLayoutOptions
) {
  const primary =
    primarySlotIndex ?? activeSlotIndex ?? null;
  const selected =
    selectedSlotIndices.length > 0
      ? selectedSlotIndices
      : primary !== null
        ? [primary]
        : [];
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (showPrintableGuide && printableArea) {
    ctx.save();
    ctx.fillStyle = "rgba(148, 163, 184, 0.12)";
    const { x, y, w, h } = printableArea;
    if (y > 0) ctx.fillRect(0, 0, ctx.canvas.width, y);
    if (x > 0) ctx.fillRect(0, 0, x, ctx.canvas.height);
    if (x + w < ctx.canvas.width) {
      ctx.fillRect(x + w, 0, ctx.canvas.width - x - w, ctx.canvas.height);
    }
    if (y + h < ctx.canvas.height) {
      ctx.fillRect(0, y + h, ctx.canvas.width, ctx.canvas.height - y - h);
    }
    ctx.strokeStyle = "rgba(100, 116, 139, 0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

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

    const isPrimary = primary === slot.index;
    const isSelected = selected.includes(slot.index);

    if (isSelected) {
      if (isPrimary && showPassportGuide) {
        drawPassportGuide(ctx, slot.x, slot.y, slot.w, slot.h);
      }

      ctx.save();
      ctx.strokeStyle = isPrimary ? "#2563eb" : "rgba(37, 99, 235, 0.55)";
      ctx.lineWidth = isPrimary ? 3 : 2;
      ctx.setLineDash(isPrimary ? [] : [6, 4]);
      ctx.strokeRect(slot.x + 1, slot.y + 1, slot.w - 2, slot.h - 2);
      ctx.restore();
    }
  }
}
