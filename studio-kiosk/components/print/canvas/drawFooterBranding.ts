import { drawRoundedRect } from "./drawRoundedRect";

export function drawFooterBranding(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    logo: HTMLImageElement;
    logoHeightRatio?: number; // ⬅️ control HEIGHT (0–1)
  }
) {
  const {
    x,
    y,
    width,
    height,
    logo,
    logoHeightRatio = 0.45, // default: 45% footer
  } = options;

  const footerHeight = 130;
  const footerTop = y + height - footerHeight;
  const centerX = x + width / 2;

  // ======================
  // LOGO (AUTO WIDTH)
  // ======================
  const aspectRatio =
    logo.naturalWidth / logo.naturalHeight;

  const logoHeight =
    footerHeight * logoHeightRatio;

  const logoWidth =
    logoHeight * aspectRatio;

  const logoY = footerTop + 23;

  ctx.globalAlpha = 0.9;
  ctx.drawImage(
    logo,
    centerX - logoWidth / 2,
    logoY,
    logoWidth,
    logoHeight
  );
  ctx.globalAlpha = 1;

  // ======================
  // DATE BADGE
  // ======================
  const dateText = new Date()
    .toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  ctx.font = "600 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const paddingX = 18;
  const badgeHeight = 30;
  const textWidth =
    ctx.measureText(dateText).width;

  const badgeWidth =
    textWidth + paddingX * 2;

  const badgeX =
    centerX - badgeWidth / 2;

  const badgeY =
    logoY + logoHeight + 10;

  drawRoundedRect(
    ctx,
    badgeX,
    badgeY,
    badgeWidth,
    badgeHeight,
    18
  );

  ctx.fillStyle = "#fff";
  ctx.fillText(
    dateText,
    centerX,
    badgeY + badgeHeight / 2 + 1
  );
}
