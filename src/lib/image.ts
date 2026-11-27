/**
 * Product photo compression in the browser (PRD CAT-5): square-cropped, WebP, ≤ 200 KB.
 * Saves the Supabase free tier's storage and the shops' mobile data.
 */
export const PHOTO_MAX_BYTES = 200 * 1024
const SIZE = 640

export async function compressPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const out = Math.min(SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
  bitmap.close()
  for (const quality of [0.82, 0.7, 0.58, 0.45, 0.35]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
    if (blob && blob.size <= PHOTO_MAX_BYTES) return blob
  }
  throw new Error('photo too large')
}
