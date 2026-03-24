export function applyWeddingToneCurve(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();

  // Soft highlight glow
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#fff";
  ctx.fillRect(x, y, w, h);

  // Matte shadow (lift black)
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#eae6df"; // cream shadow
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}

export function applyWeddingLUT(
  ctx: CanvasRenderingContext2D
) {
  ctx.filter =
    "brightness(1.03) contrast(0.96) saturate(1.08)";
}
