/**
 * Stub for future passport-color and AI-theme compositing (Phase 2+).
 * Uses Sharp to flatten a transparent subject onto a background layer.
 */

/**
 * @param {object} _options
 * @param {string} _options.subjectPath - Path to transparent PNG
 * @param {string} _options.outputPath - Destination raster path
 * @param {{ type: 'solid', color: string } | { type: 'image', path: string }} _options.background
 * @returns {Promise<string>}
 */
export async function compositeSubject(_options) {
  throw new Error("imageComposite.compositeSubject is not implemented yet");
}
