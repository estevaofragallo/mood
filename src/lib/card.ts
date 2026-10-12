import { db } from './db'
import { KIND_META, dotDate } from './periods'
import { ENTRY_LABEL, ENTRY_ORDER, type Entry, type Period, type Reading } from './types'
import { currentTheme } from './theme'
import { fetchCover } from './images'
import type { Daily } from './daily'

export type CardFormat = 'story' | 'carousel'

interface Ctx {
  period: Period
  reading: Reading
  entries: Entry[]
  images: Map<string, ImageBitmap>
}

const INK = '#f4f1f8'
const INK2 = 'rgba(244,241,248,.66)'
const INK3 = 'rgba(244,241,248,.4)'

/* fontes do tema ativo */
const ui = () => `'${currentTheme().fonts.ui}', system-ui, sans-serif`
const num = () => `'${currentTheme().fonts.num}', ui-monospace, monospace`
/** fonte de título: peso e escala do tema */
const disp = (size: number) => {
  const t = currentTheme()
  return `${t.display.weight} ${Math.round(size * t.display.scale)}px '${t.fonts.display}', sans-serif`
}
/** tamanho efetivo e altura de linha do título no tema ativo */
const dispMetrics = (size: number) => {
  const t = currentTheme()
  const px = Math.round(size * t.display.scale)
  return { px, lineH: Math.round(px * Math.max(0.98, t.display.leading + 0.06)) }
}
/** caixa alta quando o tema pede */
const dt = (s: string) => (currentTheme().display.upper ? s.toUpperCase() : s)
const accent = () => currentTheme().color.accent

async function ensureFonts() {
  if (!document.fonts) return
  await Promise.all(
    [disp(100), `600 40px ${ui()}`, `500 40px ${ui()}`, `900 60px ${num()}`, `700 40px ${num()}`].map((f) => document.fonts.load(f).catch(() => null)),
  )
}

async function loadImages(entries: Entry[]) {
  const map = new Map<string, ImageBitmap>()
  for (const e of entries) {
    if (!e.imageId || map.has(e.imageId)) continue
    const blob = await db.getBlob(e.imageId)
    if (!blob) continue
    try {
      map.set(e.imageId, await createImageBitmap(blob))
    } catch {
      /* ignora */
    }
  }
  return map
}

/* ───────────────── primitivas de desenho ───────────────── */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

let grainTile: HTMLCanvasElement | null = null
function grain() {
  if (grainTile) return grainTile
  const [c, g] = canvas(220, 220)
  const img = g.createImageData(220, 220)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 34
  }
  g.putImageData(img, 0, 0)
  return (grainTile = c)
}

function background(g: CanvasRenderingContext2D, w: number, h: number, palette: string[]) {
  g.fillStyle = '#050506'
  g.fillRect(0, 0, w, h)
  const spots: [number, number, number, string, number][] = [
    [0.1, 0.08, 0.75, palette[0], 0.55],
    [0.95, 0.42, 0.65, palette[1] ?? palette[0], 0.38],
    [0.2, 0.95, 0.7, palette[2] ?? palette[0], 0.42],
    [0.85, 0.02, 0.4, palette[3] ?? palette[0], 0.22],
  ]
  for (const [x, y, r, c, a] of spots) {
    const rad = r * Math.max(w, h)
    const grd = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, rad)
    grd.addColorStop(0, withAlpha(c, a))
    grd.addColorStop(0.55, withAlpha(c, a * 0.25))
    grd.addColorStop(1, withAlpha(c, 0))
    g.fillStyle = grd
    g.fillRect(0, 0, w, h)
  }
  // véu escuro para legibilidade
  const veil = g.createLinearGradient(0, 0, 0, h)
  veil.addColorStop(0, 'rgba(5,5,6,.15)')
  veil.addColorStop(0.5, 'rgba(5,5,6,.45)')
  veil.addColorStop(1, 'rgba(5,5,6,.8)')
  g.fillStyle = veil
  g.fillRect(0, 0, w, h)
  // linhas de varredura y2k
  g.fillStyle = 'rgba(255,255,255,.018)'
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1)
}

function finish(g: CanvasRenderingContext2D, w: number, h: number) {
  g.save()
  g.globalCompositeOperation = 'overlay'
  g.fillStyle = g.createPattern(grain(), 'repeat')!
  g.fillRect(0, 0, w, h)
  g.restore()
}

function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#ffffff') {
  g.save()
  g.translate(x, y)
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = r * 1.6
  g.beginPath()
  g.moveTo(0, -r)
  g.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0)
  g.quadraticCurveTo(r * 0.12, r * 0.12, 0, r)
  g.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0)
  g.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r)
  g.fill()
  g.restore()
}

function chromeText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: CanvasTextAlign = 'left') {
  g.save()
  g.font = disp(size)
  g.textAlign = align
  g.textBaseline = 'alphabetic'
  g.shadowColor = accent()
  g.shadowBlur = size * 0.5
  g.fillStyle = INK
  g.fillText(dt(text), x, y)
  g.restore()
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines)
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '…'
    return cut
  }
  return lines
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

function drawCover(g: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s, sh = h / s
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

function tile(g: CanvasRenderingContext2D, ctx: Ctx, e: Entry, x: number, y: number, size: number, radius: number) {
  g.save()
  g.shadowColor = 'rgba(0,0,0,.6)'
  g.shadowBlur = 40
  g.shadowOffsetY = 18
  rrect(g, x, y, size, size, radius)
  g.fillStyle = '#16161a'
  g.fill()
  g.restore()
  g.save()
  rrect(g, x, y, size, size, radius)
  g.clip()
  const img = e.imageId ? ctx.images.get(e.imageId) : undefined
  if (img) drawCover(g, img, x, y, size, size)
  else {
    const p = ctx.reading.palette
    const grd = g.createLinearGradient(x, y, x + size, y + size)
    grd.addColorStop(0, p[(e.title.length + 1) % p.length])
    grd.addColorStop(1, p[(e.title.length + 3) % p.length])
    g.fillStyle = grd
    g.fillRect(x, y, size, size)
    g.fillStyle = 'rgba(0,0,0,.25)'
    g.fillRect(x, y, size, size)
    g.fillStyle = '#fff'
    g.font = disp(size * 0.15)
    wrap(g, dt(e.title), size * 0.84, 3).forEach((l, i) => g.fillText(l, x + size * 0.08, y + size * 0.62 + i * size * 0.15))
  }
  g.restore()
  g.save()
  rrect(g, x + 0.5, y + 0.5, size - 1, size - 1, radius)
  g.strokeStyle = 'rgba(255,255,255,.16)'
  g.lineWidth = 2
  g.stroke()
  g.restore()
}

function typeBadge(g: CanvasRenderingContext2D, e: Entry, x: number, y: number, scale = 1) {
  g.save()
  g.font = `600 ${18 * scale}px ${ui()}`
  const label = ENTRY_LABEL[e.type].one.toUpperCase()
  const h = 34 * scale
  rrect(g, x + 14 * scale, y + 14 * scale, g.measureText(label).width + 26 * scale, h, h / 2)
  g.fillStyle = 'rgba(5,5,6,.6)'
  g.fill()
  g.fillStyle = INK
  g.textBaseline = 'middle'
  g.fillText(label, x + 27 * scale, y + 14 * scale + h / 2 + 1)
  g.restore()
}

function polaroid(g: CanvasRenderingContext2D, img: ImageBitmap, cx: number, cy: number, w: number, rot: number, caption?: string) {
  const pad = w * 0.05
  const h = w + pad * 4
  g.save()
  g.translate(cx, cy)
  g.rotate(rot)
  g.shadowColor = 'rgba(0,0,0,.7)'
  g.shadowBlur = 50
  g.shadowOffsetY = 24
  g.fillStyle = '#eeebe6'
  g.fillRect(-w / 2, -h / 2, w, h)
  g.shadowColor = 'transparent'
  drawCover(g, img, -w / 2 + pad, -h / 2 + pad, w - pad * 2, w - pad * 2)
  // brilho de flash
  const fl = g.createRadialGradient(-w * 0.2, -h * 0.25, 0, -w * 0.2, -h * 0.25, w * 0.7)
  fl.addColorStop(0, 'rgba(255,255,255,.18)')
  fl.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = fl
  g.fillRect(-w / 2 + pad, -h / 2 + pad, w - pad * 2, w - pad * 2)
  if (caption) {
    g.fillStyle = '#2a2730'
    g.font = disp(pad * 1.5)
    g.textAlign = 'center'
    g.fillText(wrap(g, dt(caption), w - pad * 4, 1)[0], 0, h / 2 - pad * 1.2)
  }
  g.restore()
}

function stars(g: CanvasRenderingContext2D, x: number, y: number, size: number, value: number, color: string) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * size * 1.15 + size / 2
    const fill = Math.max(0, Math.min(1, value - i))
    const path = new Path2D()
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? size * 0.22 : size * 0.5
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      path.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    path.closePath()
    g.fillStyle = 'rgba(255,255,255,.18)'
    g.fill(path)
    if (fill > 0) {
      g.save()
      g.beginPath()
      g.rect(cx - size / 2, y - size / 2, size * fill, size)
      g.clip()
      g.fillStyle = color
      g.fill(path)
      g.restore()
    }
  }
}

function counts(entries: Entry[]) {
  return ENTRY_ORDER.map((t) => [t, entries.filter((e) => e.type === t).length] as const).filter(([, n]) => n > 0)
}

function header(g: CanvasRenderingContext2D, ctx: Ctx, w: number, top: number, pad: number) {
  chromeText(g, 'moody', pad, top + 60, 76)
  g.font = disp(76)
  sparkle(g, pad + g.measureText(dt('moody')).width + 22, top + 6, 13, accent())
  g.fillStyle = INK2
  g.font = `700 30px ${num()}`
  g.textAlign = 'right'
  g.fillText(`${dotDate(ctx.period.start)} — ${dotDate(ctx.period.end)}`, w - pad, top + 50)
  g.textAlign = 'left'
}

function paletteDots(g: CanvasRenderingContext2D, palette: string[], x: number, y: number, r: number) {
  palette.forEach((c, i) => {
    g.beginPath()
    g.arc(x + i * r * 1.55, y, r, 0, Math.PI * 2)
    g.fillStyle = c
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = '#0b0b0e'
    g.stroke()
  })
}

function statsRow(g: CanvasRenderingContext2D, ctx: Ctx, x: number, y: number, maxW: number) {
  const list = counts(ctx.entries)
  if (!list.length) return
  const col = Math.min(200, maxW / list.length)
  list.slice(0, 6).forEach(([t, n], i) => {
    g.fillStyle = INK
    g.font = `900 64px ${num()}`
    g.fillText(String(n).padStart(2, '0'), x + i * col, y)
    g.fillStyle = INK3
    g.font = `500 24px ${ui()}`
    g.fillText(n === 1 ? ENTRY_LABEL[t].one : ENTRY_LABEL[t].many, x + i * col, y + 40)
  })
}

/* ───────────────── stories 1080×1920 ───────────────── */

function story(ctx: Ctx): HTMLCanvasElement {
  const W = 1080, H = 1920, P = 84
  const [c, g] = canvas(W, H)
  const { reading } = ctx
  background(g, W, H, reading.palette)
  header(g, ctx, W, 96, P)

  g.fillStyle = INK3
  g.font = `600 24px ${ui()}`
  g.letterSpacing = '6px'
  g.fillText(`RECAP · ${KIND_META[ctx.period.kind].label.toUpperCase()} · ${ctx.period.title.toUpperCase()}`, P, 300)
  g.letterSpacing = '0px'

  g.font = disp(124)
  const sm = dispMetrics(124)
  const nameLines = wrap(g, dt(reading.name), W - P * 2, 3)
  g.fillStyle = INK
  g.shadowColor = withAlpha(reading.palette[0], 0.7)
  g.shadowBlur = 60
  const nameTop = 300 + 30 + sm.px * 0.9 // abaixo da linha de rótulo
  nameLines.forEach((l, i) => g.fillText(l, P, nameTop + i * sm.lineH))
  g.shadowBlur = 0
  let y = nameTop + (nameLines.length - 1) * sm.lineH + 80

  g.font = `500 36px ${ui()}`
  g.fillStyle = INK2
  let x = P
  reading.words.forEach((w) => {
    sparkle(g, x + 10, y - 12, 10, reading.palette[0])
    x += 30
    g.fillText(w, x, y)
    x += g.measureText(w).width + 34
  })
  y += 60
  if (reading.sky?.line) {
    g.fillStyle = currentTheme().color.accent2
    g.font = `600 28px ${ui()}`
    g.fillText(wrap(g, `☾ ${reading.sky.line}`, W - P * 2, 1)[0], P, y)
    y += 50
  }

  // colagem
  const photos = ctx.entries.filter((e) => e.type === 'photo' && e.imageId && ctx.images.has(e.imageId))
  const media = ctx.entries.filter((e) => e.type !== 'photo')
  const top = Math.max(y + 30, 820)
  if (photos.length) {
    // com capas: duas polaroids + fileira de capas; sem capas: três polaroids maiores
    const spots: [number, number, number, number][] = media.length
      ? [[W * 0.37, top + 250, 480, -0.06], [W * 0.71, top + 215, 400, 0.07]]
      : [[W * 0.36, top + 270, 500, -0.07], [W * 0.72, top + 230, 400, 0.08], [W * 0.6, top + 600, 380, -0.03]]
    photos.slice(0, spots.length).forEach((p, i) => {
      const [cx, cy, w, r] = spots[i]
      polaroid(g, ctx.images.get(p.imageId!)!, cx, cy, w, r, p.note)
    })
    if (media.length) media.slice(0, 4).forEach((e, i) => { tile(g, ctx, e, P + i * 236, 1400, 212, 26); typeBadge(g, e, P + i * 236, 1400, 0.8) })
  } else {
    const size = 280
    media.slice(0, 6).forEach((e, i) => {
      const x = P + (i % 3) * (size + 32), y = top + Math.floor(i / 3) * (size + 32)
      tile(g, ctx, e, x, y, size, 32)
      typeBadge(g, e, x, y, 0.9)
    })
  }

  statsRow(g, ctx, P, 1712, W - P * 2)
  paletteDots(g, reading.palette, P + 18, 1836, 18)
  g.fillStyle = INK3
  g.font = `500 22px ${ui()}`
  g.textAlign = 'right'
  g.fillText('feito no moody ✦', W - P, 1844)
  g.textAlign = 'left'
  sparkle(g, W - 150, 360, 18)
  sparkle(g, 120, 1610, 12, reading.palette[1])
  finish(g, W, H)
  return c
}

/* ───────────────── carrossel 1080×1350 ───────────────── */

function carousel(ctx: Ctx): HTMLCanvasElement[] {
  const W = 1080, H = 1350, P = 84
  const { reading } = ctx
  const slides: HTMLCanvasElement[] = []

  // 1 · capa
  {
    const [c, g] = canvas(W, H)
    background(g, W, H, reading.palette)
    header(g, ctx, W, 80, P)
    g.fillStyle = INK3
    g.font = `600 22px ${ui()}`
    g.letterSpacing = '6px'
    g.fillText(`${KIND_META[ctx.period.kind].label.toUpperCase()} · ${ctx.period.title.toUpperCase()}`, P, 420)
    g.letterSpacing = '0px'
    const cm = dispMetrics(136)
    g.font = disp(136)
    g.fillStyle = INK
    g.shadowColor = withAlpha(reading.palette[0], 0.7)
    g.shadowBlur = 70
    const lines = wrap(g, dt(reading.name), W - P * 2, 3)
    const top = 420 + 30 + cm.px * 0.9
    lines.forEach((l, i) => g.fillText(l, P, top + i * cm.lineH))
    g.shadowBlur = 0
    let y = top + (lines.length - 1) * cm.lineH + 84
    g.font = `500 34px ${ui()}`
    g.fillStyle = INK2
    g.fillText(wrap(g, reading.words.join('  ✧  '), W - P * 2, 1)[0], P, y)
    y += 64
    if (reading.sky?.line) {
      g.fillStyle = currentTheme().color.accent2
      g.font = `600 28px ${ui()}`
      g.fillText(wrap(g, `☾ ${reading.sky.line}`, W - P * 2, 1)[0], P, y)
      y += 54
    }
    // o resumo ocupa só o espaço livre acima dos números
    const room = Math.floor((H - 300 - y) / 44) + 1
    if (room > 0) {
      g.font = `400 30px ${ui()}`
      g.fillStyle = INK3
      wrap(g, reading.summary, W - P * 2, Math.min(3, room)).forEach((l, i) => g.fillText(l, P, y + i * 44))
    }
    const bw = (W - P * 2) / reading.palette.length
    reading.palette.forEach((col, i) => {
      g.fillStyle = col
      g.fillRect(P + i * bw, H - 150, bw, 26)
    })
    statsRow(g, ctx, P, H - 230, W - P * 2)
    sparkle(g, W - 140, 300, 20)
    finish(g, W, H)
    slides.push(c)
  }

  // 2 · mídia com notas
  const media = ctx.entries.filter((e) => e.type !== 'photo' && e.type !== 'place')
  if (media.length) {
    const [c, g] = canvas(W, H)
    background(g, W, H, reading.palette.slice(1).concat(reading.palette[0]))
    chromeText(g, 'o que passou por aqui', P, 170, 74)
    // grade de capas: 2 colunas até 4 itens, 3 colunas acima disso
    const items = media.slice(0, 6)
    const cols = items.length <= 4 ? 2 : 3
    const gap = cols === 2 ? 56 : 40
    const size = Math.min(cols === 2 ? 360 : 280, Math.floor((W - P * 2 - gap * (cols - 1)) / cols))
    const left = Math.round((W - (cols * size + (cols - 1) * gap)) / 2)
    const rows = Math.ceil(items.length / cols)
    const textH = cols === 2 ? 150 : 140
    const blockH = rows * (size + textH) - 40
    const top = Math.max(240, Math.round(240 + (H - 240 - 60 - blockH) / 2))
    items.forEach((e, i) => {
      const x = left + (i % cols) * (size + gap)
      const y = top + Math.floor(i / cols) * (size + textH)
      tile(g, ctx, e, x, y, size, cols === 2 ? 30 : 24)
      typeBadge(g, e, x, y, cols === 2 ? 1 : 0.85)
      const ty = y + size + (cols === 2 ? 50 : 44)
      g.fillStyle = INK
      g.font = disp(cols === 2 ? 44 : 36)
      g.fillText(wrap(g, dt(e.title), size, 1)[0], x, ty)
      g.fillStyle = INK2
      g.font = `400 ${cols === 2 ? 24 : 21}px ${ui()}`
      const sub = [e.subtitle, e.year].filter(Boolean).join(' · ')
      if (sub) g.fillText(wrap(g, sub, size, 1)[0], x, ty + (cols === 2 ? 36 : 31))
      if (typeof e.rating === 'number') stars(g, x, ty + (cols === 2 ? 76 : 66), cols === 2 ? 26 : 22, e.rating, reading.palette[0])
    })
    if (media.length > items.length) {
      g.fillStyle = INK3
      g.font = `500 24px ${ui()}`
      g.textAlign = 'right'
      g.fillText(`+ ${media.length - items.length} no período`, W - P, H - 60)
      g.textAlign = 'left'
    }
    finish(g, W, H)
    slides.push(c)
  }

  // 3 · fotos
  const photos = ctx.entries.filter((e) => e.type === 'photo' && e.imageId && ctx.images.has(e.imageId))
  if (photos.length) {
    const [c, g] = canvas(W, H)
    background(g, W, H, reading.palette.slice(2).concat(reading.palette.slice(0, 2)))
    const n = Math.min(photos.length, 4)
    const layouts: Record<number, [number, number, number, number][]> = {
      1: [[W / 2, H / 2, 760, -0.04]],
      2: [[W * 0.36, H * 0.4, 560, -0.06], [W * 0.64, H * 0.64, 520, 0.05]],
      3: [[W * 0.32, H * 0.3, 470, -0.07], [W * 0.7, H * 0.42, 440, 0.06], [W * 0.42, H * 0.7, 460, 0.02]],
      4: [[W * 0.3, H * 0.28, 420, -0.06], [W * 0.72, H * 0.3, 400, 0.07], [W * 0.3, H * 0.7, 400, 0.04], [W * 0.7, H * 0.72, 420, -0.05]],
    }
    layouts[n].forEach(([cx, cy, w, r], i) => polaroid(g, ctx.images.get(photos[i].imageId!)!, cx, cy, w, r, photos[i].note))
    sparkle(g, W - 120, 110, 22)
    sparkle(g, 110, H - 120, 14, reading.palette[0])
    finish(g, W, H)
    slides.push(c)
  }

  // 4 · lugares e frases
  const places = ctx.entries.filter((e) => e.type === 'place')
  const quotes = ctx.entries.filter((e) => e.note && e.type !== 'photo')
  if (places.length || quotes.length) {
    const [c, g] = canvas(W, H)
    background(g, W, H, reading.palette.slice().reverse())
    const nP = Math.min(places.length, 5), nQ = Math.min(quotes.length, 4)
    const est = (nP ? 90 + nP * 66 + 60 : 0) + (nQ ? 100 + nQ * 126 : 0)
    let y = Math.max(190, Math.round((H - est) / 2) + 40)
    sparkle(g, W - 130, 120, 18)
    if (places.length) {
      chromeText(g, 'por onde andei', P, y, 74)
      y += 90
      places.slice(0, 5).forEach((p) => {
        sparkle(g, P + 12, y - 12, 10, reading.palette[0])
        g.fillStyle = INK
        g.font = `500 40px ${ui()}`
        g.fillText(wrap(g, p.title, 620, 1)[0], P + 44, y)
        if (p.subtitle) {
          g.fillStyle = INK3
          g.font = `400 28px ${ui()}`
          g.textAlign = 'right'
          g.fillText(p.subtitle, W - P, y)
          g.textAlign = 'left'
        }
        y += 66
      })
      y += 60
    }
    if (quotes.length) {
      chromeText(g, 'frases soltas', P, y, 74)
      y += 100
      for (const q of quotes.slice(0, 4)) {
        if (y > H - 140) break
        g.fillStyle = INK
        g.font = disp(44)
        const lines = wrap(g, dt(`“${q.note}”`), W - P * 2, 2)
        lines.forEach((l, i) => g.fillText(l, P, y + i * 50))
        y += lines.length * 50 + 6
        g.fillStyle = INK3
        g.font = `500 24px ${ui()}`
        g.fillText(`— sobre ${q.title}`, P, y)
        y += 70
      }
    }
    finish(g, W, H)
    slides.push(c)
  }

  return slides
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('falha ao exportar'))), 'image/png'))

export async function renderRecap(format: CardFormat, period: Period, reading: Reading, entries: Entry[]): Promise<Blob[]> {
  await ensureFonts()
  const images = await loadImages(entries)
  const ctx: Ctx = { period, reading, entries, images }
  const canvases = format === 'story' ? [story(ctx)] : carousel(ctx)
  const blobs = await Promise.all(canvases.map(toBlob))
  images.forEach((b) => b.close())
  return blobs
}

/* ───────────────── indicação do dia 1080×1920 ───────────────── */

const DAILY_LABEL: Record<string, string> = { album: 'ÁLBUM', film: 'FILME', series: 'SÉRIE', book: 'LIVRO' }

export async function renderDaily(daily: Daily): Promise<Blob> {
  await ensureFonts()
  const W = 1080, H = 1920, P = 84
  const t = currentTheme()
  const [c, g] = canvas(W, H)
  const p = daily.pick

  // capa: baixa com CORS e passa pelo mesmo tratamento das fotos; sem capa, bloco do tema
  let cover: ImageBitmap | null = null
  if (p.coverUrl) {
    const blob = await fetchCover(p.coverUrl)
    if (blob) cover = await createImageBitmap(blob).catch(() => null)
  }

  background(g, W, H, [t.color.accent, t.color.accent2, '#0a0a12', t.color.accent])

  // cabeçalho
  chromeText(g, 'moody', P, 156, 76)
  g.font = disp(76)
  sparkle(g, P + g.measureText(dt('moody')).width + 22, 102, 13, accent())
  g.fillStyle = INK2
  g.font = `700 30px ${num()}`
  g.textAlign = 'right'
  const [y0, m0, d0] = daily.date.split('-')
  g.fillText(`${d0}.${m0}.${y0.slice(2)}`, W - P, 146)
  g.textAlign = 'left'

  g.fillStyle = t.color.accent2
  g.font = `700 26px ${ui()}`
  g.letterSpacing = '8px'
  g.fillText(`INDICAÇÃO DO DIA${daily.mood ? ` · ${moodName(daily.mood).toUpperCase()}` : ''}`, P, 280)
  g.letterSpacing = '0px'

  // mede o bloco (capa + textos) para centralizá-lo entre o rótulo e o rodapé
  const cw = 600, ch = 900
  const m = dispMetrics(96)
  g.font = disp(96)
  const titleLines = wrap(g, dt(p.title), W - P * 2, 2)
  g.font = `400 34px ${ui()}`
  const whyLines = wrap(g, p.why, W - P * 2, 3)
  const blockH = ch + 76 + m.px * 0.85 + (titleLines.length - 1) * m.lineH + 54 + 64 + (whyLines.length - 1) * 46 + 20
  const areaTop = 330, areaBottom = H - 170
  const cx = (W - cw) / 2
  const cy = areaTop + Math.max(0, (areaBottom - areaTop - blockH) / 2)

  g.save()
  g.shadowColor = withAlpha(t.color.accent, 0.55)
  g.shadowBlur = 90
  g.shadowOffsetY = 30
  rrect(g, cx, cy, cw, ch, t.radius.lg * 2)
  g.fillStyle = '#0b0b10'
  g.fill()
  g.restore()
  g.save()
  rrect(g, cx, cy, cw, ch, t.radius.lg * 2)
  g.clip()
  if (cover) drawCover(g, cover, cx, cy, cw, ch)
  else {
    // sem capa: bloco do tema com um brilho, sem repetir o título
    const grd = g.createLinearGradient(cx, cy, cx + cw, cy + ch)
    grd.addColorStop(0, t.color.accent)
    grd.addColorStop(1, '#000')
    g.fillStyle = grd
    g.fillRect(cx, cy, cw, ch)
    g.fillStyle = 'rgba(255,255,255,.06)'
    for (let yy = cy; yy < cy + ch; yy += 6) g.fillRect(cx, yy, cw, 2)
    sparkle(g, cx + cw / 2, cy + ch * 0.45, 120, INK)
  }
  g.restore()
  g.save()
  rrect(g, cx + 1, cy + 1, cw - 2, ch - 2, t.radius.lg * 2)
  g.strokeStyle = 'rgba(255,255,255,.22)'
  g.lineWidth = 3
  g.stroke()
  g.restore()
  // selo do tipo sobre a capa
  g.save()
  g.font = `800 24px ${ui()}`
  const label = DAILY_LABEL[p.type] ?? ''
  const lw = g.measureText(label).width + 40
  rrect(g, cx + 24, cy + 24, lw, 48, t.radius.sm * 2)
  g.fillStyle = t.color.accent
  g.fill()
  g.fillStyle = t.color.accentInk
  g.textBaseline = 'middle'
  g.fillText(label, cx + 44, cy + 49)
  g.restore()

  // título, autoria, porquê
  let y = cy + ch + 76 + m.px * 0.85
  g.font = disp(96)
  g.fillStyle = INK
  g.shadowColor = withAlpha(t.color.accent, 0.6)
  g.shadowBlur = 40
  titleLines.forEach((l, i) => g.fillText(l, P, y + i * m.lineH))
  g.shadowBlur = 0
  y += (titleLines.length - 1) * m.lineH + 54
  g.fillStyle = INK2
  g.font = `500 32px ${ui()}`
  g.fillText(wrap(g, [p.creator, p.year].filter(Boolean).join(' · '), W - P * 2, 1)[0] ?? '', P, y)
  y += 64
  g.fillStyle = INK
  g.font = `400 34px ${ui()}`
  whyLines.forEach((l, i) => g.fillText(l, P, y + i * 46))

  // rodapé
  g.fillStyle = INK3
  g.font = `500 24px ${ui()}`
  if (daily.sky) {
    g.fillStyle = t.color.accent2
    g.font = `600 26px ${ui()}`
    g.fillText(wrap(g, `☾ ${daily.sky}`, W - P * 2 - 260, 1)[0], P, H - 96)
  }
  g.fillStyle = INK3
  g.font = `500 22px ${ui()}`
  g.textAlign = 'right'
  g.fillText('feito no moody ✦', W - P, H - 96)
  g.textAlign = 'left'
  sparkle(g, W - 130, 300, 16)
  finish(g, W, H)
  cover?.close()
  return toBlob(c)
}

const MOOD_NAMES: Record<string, string> = { leve: 'leve', intenso: 'intenso', nostalgico: 'nostálgico', introspectivo: 'introspectivo', inquieto: 'inquieto', cansado: 'cansado', romantico: 'romântico', curioso: 'curioso' }
const moodName = (m: string) => MOOD_NAMES[m] ?? m
