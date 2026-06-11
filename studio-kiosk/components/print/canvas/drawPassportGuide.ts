/**
 * Pas-foto composition guides (head oval + eye line) on the active slot.
 */
export function drawPassportGuide(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const cx = x + w / 2;
  const eyeY = y + h * 0.38;
  const ovalW = w * 0.62;
  const ovalH = h * 0.72;
  const ovalY = y + h * 0.12;

  ctx.save();

  ctx.strokeStyle = "rgba(37, 99, 235, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.ellipse(cx, ovalY + ovalH / 2, ovalW / 2, ovalH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(234, 179, 8, 0.7)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.12, eyeY);
  ctx.lineTo(x + w * 0.88, eyeY);
  ctx.stroke();

  ctx.fillStyle = "rgba(37, 99, 235, 0.85)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Geser / zoom untuk menyesuaikan", x + 6, y + h - 8);

  ctx.restore();
}
