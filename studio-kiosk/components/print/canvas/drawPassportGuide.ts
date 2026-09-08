/**
 * Pas-foto composition guides (head, eye line, shoulders) on the active slot.
 */
export function drawPassportGuide(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const cx = x + w * 0.5;
  const headCy = y + h * 0.405;
  const rx = (w * 0.58) / 2;
  const ry = (h * 0.64) / 2;
  const eyeY = y + h * 0.355;
  const chin = headCy + ry;

  ctx.save();
  ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
  ctx.lineWidth = Math.max(0.9, w * 0.0035);
  ctx.beginPath();
  ctx.ellipse(cx, headCy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - w * 0.09, chin);
  ctx.bezierCurveTo(
    cx - w * 0.18,
    chin + h * 0.08,
    x + w * 0.04,
    y + h * 0.9,
    x + 4,
    y + h
  );
  ctx.moveTo(cx + w * 0.09, chin);
  ctx.bezierCurveTo(
    cx + w * 0.18,
    chin + h * 0.08,
    x + w * 0.96,
    y + h * 0.9,
    x + w - 4,
    y + h
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(250, 204, 21, 0.7)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = Math.max(0.8, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(cx - rx + 8, eyeY);
  ctx.lineTo(cx + rx - 8, eyeY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `${Math.max(9, w * 0.03)}px system-ui, sans-serif`;
  ctx.fillText("Kepala di oval · mata di garis", x + 6, y + h - 8);

  ctx.restore();
}
