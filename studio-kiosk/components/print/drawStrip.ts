import { drawSmartCover } from "./canvas/drawSmartCover";

export function drawStrip(
  ctx: CanvasRenderingContext2D,
  imgs: HTMLImageElement[]
) {
  const pad = 60;
  const gap = 40;

  const usable =
    ctx.canvas.height - pad * 2 - gap * (imgs.length - 1);

  const h = usable / imgs.length;
  const w = ctx.canvas.width - pad * 2;

  imgs.forEach((img, i) => {
    drawSmartCover(
      ctx,
      img,
      pad,
      pad + i * (h + gap),
      w,
      h
    );
  });
}
