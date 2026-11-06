// @ts-check
/**
 * Prepares a reference image before it goes to Decart.
 *
 * Decart recommends at least 512×512 and under 2048 px on the longest side.
 * Big phone photos (12+ MP) upload slowly and add nothing, so we downscale to
 * 1536 px and re-encode as high-quality JPEG. Smaller is faster to swap live.
 */
const MAX_SIDE = 1536;
const MIN_SIDE = 512;

/**
 * @param {File} file
 * @returns {Promise<{ blob: Blob, width: number, height: number, warning: string | null }>}
 */
export async function prepareReferenceImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Use a JPEG, PNG or WebP image.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  const warning =
    Math.min(width, height) < MIN_SIDE
      ? `Low resolution (${width}×${height}). Use at least ${MIN_SIDE} px on the short side for a faithful result.`
      : null;
  return { blob, width, height, warning };
}
