import sharp from "sharp";
import {
  getPassportSize,
  normalizePassportSizeId,
  passportSizeToPixels,
  PASSPORT_DPI,
} from "./passportSizes.js";

/**
 * Crop & resize transparent subject onto a solid background at standard pas foto dimensions.
 * @param {{ subjectPath: string, outputPath: string, backgroundColor: string, sizeId?: string }} options
 */
export async function compositePassportPhoto({
  subjectPath,
  outputPath,
  backgroundColor,
  sizeId,
}) {
  const size = getPassportSize(normalizePassportSizeId(sizeId));
  const { widthPx, heightPx } = passportSizeToPixels(size, PASSPORT_DPI);

  const resizedSubject = await sharp(subjectPath)
    .resize(widthPx, heightPx, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 4,
      background: backgroundColor,
    },
  })
    .composite([{ input: resizedSubject, top: 0, left: 0 }])
    .png()
    .toFile(outputPath);

  return {
    sizeId: size.id,
    widthPx,
    heightPx,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    dpi: PASSPORT_DPI,
  };
}
