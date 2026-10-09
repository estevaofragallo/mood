/**
 * Reprocessa a imagem num canvas: reduz o tamanho e, ao reexportar como JPEG,
 * descarta todos os metadados (EXIF, GPS). A foto original nunca é guardada.
 */
export async function processPhoto(file: Blob, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falha ao processar imagem'))), 'image/jpeg', 0.86),
  )
}

/** Tenta as capas em ordem e guarda a primeira que baixar. */
export async function fetchFirstCover(urls: string[]): Promise<Blob | null> {
  for (const u of urls) {
    const b = await fetchCover(u)
    if (b) return b
  }
  return null
}

/** Baixa uma capa remota para guardar localmente. Retorna null se o servidor bloquear. */
export async function fetchCover(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') || blob.size < 1200) return null
    return processPhoto(blob, 600)
  } catch {
    return null
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
export const rgbToHex = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`

/** Extrai cores dominantes por quantização simples (3 bits por canal), privilegiando cores saturadas. */
export async function dominantColors(blobs: Blob[], count = 5): Promise<string[]> {
  const buckets = new Map<number, { r: number; g: number; b: number; px: number; weight: number }>()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 48
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  for (const blob of blobs.slice(0, 16)) {
    try {
      const bmp = await createImageBitmap(blob)
      ctx.drawImage(bmp, 0, 0, 48, 48)
      bmp.close()
      const { data } = ctx.getImageData(0, 0, 48, 48)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if (max < 28 || min > 238) continue // ignora preto e branco puros
        const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
        const s = buckets.get(key) ?? { r: 0, g: 0, b: 0, px: 0, weight: 0 }
        s.r += r; s.g += g; s.b += b; s.px += 1
        s.weight += 1 + (max - min) / 64
        buckets.set(key, s)
      }
    } catch {
      /* imagem ilegível: ignora */
    }
  }
  return [...buckets.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map((s) => rgbToHex(s.r / s.px, s.g / s.px, s.b / s.px))
}
