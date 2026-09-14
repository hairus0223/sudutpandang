import sharp from "sharp";
import { computePassportFraming } from "./passportFraming.js";
import {
  getPassportSize,
  normalizePassportSizeId,
  passportSizeToPixels,
  PASSPORT_DPI,
} from "./passportSizes.js";

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const JPEG_QUALITY = Number(process.env.PASSPORT_JPEG_QUALITY) || 96;

/**
 * Extract `rect` even when it reaches past the source edges — the pas foto
 * background is a flat colour, so padded margins are indistinguishable.
 *
 * @param {string} subjectPath
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {{ width: number, height: number }} source
 */
function extractWithPadding(subjectPath, rect, source) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(source.width, rect.left + rect.width);
  const bottom = Math.min(source.height, rect.top + rect.height);

  if (right - left < 4 || bottom - top < 4) return null;

  const pipeline = sharp(subjectPath).extract({
    left,
    top,
    width: right - left,
    height: bottom - top,
  });

  const padLeft = left - rect.left;
  const padTop = top - rect.top;
  const padRight = rect.left + rect.width - right;
  const padBottom = rect.top + rect.height - bottom;

  if (padLeft || padTop || padRight || padBottom) {
    return pipeline.extend({
      left: padLeft,
      top: padTop,
      right: padRight,
      bottom: padBottom,
      background: TRANSPARENT,
    });
  }

  return pipeline;
}

/**
 * Crop & resize the transparent subject onto a solid background at standard
 * pas foto dimensions, tagged at print DPI.
 *
 * @param {{
 *   subjectPath: string,
 *   outputPath: string,
 *   backgroundColor: string,
 *   sizeId?: string,
 *   geometry?: import("./passportFraming.js").SubjectGeometry | null,
 *   jpegPath?: string | null,
 * }} options
 */
export async function compositePassportPhoto({
  subjectPath,
  outputPath,
  backgroundColor,
  sizeId,
  geometry = null,
  jpegPath = null,
}) {
  const size = getPassportSize(normalizePassportSizeId(sizeId));
  const { widthPx, heightPx } = passportSizeToPixels(size, PASSPORT_DPI);

  const source = await sharp(subjectPath).metadata();
  const rect = computePassportFraming(geometry, widthPx / heightPx);
  const framed =
    rect && source.width && source.height
      ? extractWithPadding(subjectPath, rect, {
          width: source.width,
          height: source.height,
        })
      : null;

  const resizedSubject = await (framed ?? sharp(subjectPath))
    .resize(widthPx, heightPx, {
      fit: framed ? "fill" : "contain",
      position: "north",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const composed = sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 4,
      background: backgroundColor,
    },
  }).composite([{ input: resizedSubject, top: 0, left: 0 }]);

  const flat = await composed.png().toBuffer();

  await sharp(flat)
    .withMetadata({ density: PASSPORT_DPI })
    .png({ compressionLevel: 9, effort: 9 })
    .toFile(outputPath);

  if (jpegPath) {
    await sharp(flat)
      .flatten({ background: backgroundColor })
      .withMetadata({ density: PASSPORT_DPI })
      .jpeg({
        quality: JPEG_QUALITY,
        chromaSubsampling: "4:4:4",
        mozjpeg: true,
      })
      .toFile(jpegPath);
  }

  return {
    sizeId: size.id,
    widthPx,
    heightPx,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    dpi: PASSPORT_DPI,
    framed: Boolean(framed),
  };
}
