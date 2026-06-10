import sharp from "sharp";

/**
 * Flatten a transparent subject PNG onto a solid or image background.
 * @param {object} options
 * @param {string} options.subjectPath - Path to transparent PNG
 * @param {string} options.outputPath - Destination raster path
 * @param {{ type: 'solid', color: string } | { type: 'image', path: string }} options.background
 * @returns {Promise<string>}
 */
export async function compositeSubject({ subjectPath, outputPath, background }) {
  const subjectMeta = await sharp(subjectPath).metadata();
  const width = subjectMeta.width;
  const height = subjectMeta.height;

  if (!width || !height) {
    throw new Error("Invalid subject image dimensions");
  }

  if (background.type === "solid") {
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: background.color,
      },
    })
      .composite([{ input: subjectPath, top: 0, left: 0 }])
      .png()
      .toFile(outputPath);

    return outputPath;
  }

  if (background.type === "image") {
    await sharp(background.path)
      .resize(width, height, { fit: "cover" })
      .composite([{ input: subjectPath, top: 0, left: 0 }])
      .png()
      .toFile(outputPath);

    return outputPath;
  }

  throw new Error(`Unsupported background type: ${background.type}`);
}
