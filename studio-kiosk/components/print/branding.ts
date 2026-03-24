export function drawBranding(
  ctx: CanvasRenderingContext2D,
  options: {
    studio: string;
    logo?: HTMLImageElement;
  }
) {
  const { studio, logo } = options;

  const padding = 50;
  const bottom = ctx.canvas.height - padding;

  // ===== LOGO =====
  if (logo) {
    const size = 120;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(
      logo,
      padding,
      bottom - size,
      size,
      size
    );
    ctx.globalAlpha = 1;
  }

  // ===== DATE FORMAT: JAN 2026 =====
  const date = new Date();
  const monthYear = date
    .toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  // ===== TEXT =====
  ctx.fillStyle = "#000";
  ctx.textAlign = "right";

  ctx.font = "bold 42px Arial";
  ctx.fillText(
    studio,
    ctx.canvas.width - padding,
    bottom - 20
  );

  ctx.font = "28px Arial";
  ctx.fillText(
    monthYear,
    ctx.canvas.width - padding,
    bottom + 15
  );
}
