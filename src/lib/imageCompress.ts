/**
 * Compress / convert a File (any browser-readable image, including HEIC on iOS
 * Safari which decodes via <img>) to a JPEG data URL of bounded size.
 *
 * Returns base64 (no data: prefix).
 */
export async function compressImageToJpegBase64(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<string> {
  const maxDim = opts.maxDim ?? 1600
  const quality = opts.quality ?? 0.82

  // Load via <img> so HEIC/HEIF (iOS decodes natively) work too
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Failed to decode image — try a JPEG or PNG'))
    el.src = dataUrl
  })

  const { width, height } = img
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(img, 0, 0, w, h)

  const jpegDataUrl = canvas.toDataURL('image/jpeg', quality)
  // Strip "data:image/jpeg;base64," prefix
  const base64 = jpegDataUrl.split(',')[1] || jpegDataUrl
  return base64
}