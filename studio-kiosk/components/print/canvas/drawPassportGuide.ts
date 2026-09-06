/**
 * Pas-foto composition guides (head + shoulders + eye line) on the active slot.
 */
export function drawPassportGuide(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scaleX = w / 300;
  const scaleY = h / 400;
  const bust = new Path2D(
    "M150 28 C198 28 240 72 240 128 C240 172 220 202 196 224 C184 234 176 242 174 254 C214 262 250 282 270 316 C286 344 294 372 296 400 L4 400 C6 372 14 344 30 316 C50 282 86 262 126 254 C124 242 116 234 104 224 C80 202 60 172 60 128 C60 72 102 28 150 28 Z"
  );
  const eyeY = y + h * 0.345;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, scaleY);
  ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
  ctx.lineWidth = 3 / Math.max(scaleX, scaleY);
  ctx.stroke(bust);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(234, 179, 8, 0.75)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.16, eyeY);
  ctx.lineTo(x + w * 0.84, eyeY);
  ctx.stroke();

  ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Sesuaikan kepala & bahu ke siluet", x + 6, y + h - 8);

  ctx.restore();
}
