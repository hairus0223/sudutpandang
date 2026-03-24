export function drawLogoSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#888";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "SUDUT PANDANG",
    x + w / 2,
    y + h / 2
  );
}
