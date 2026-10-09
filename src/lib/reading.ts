import { ENTRY_LABEL, ENTRY_ORDER, type Entry, type EntryType, type Period, type Reading } from './types'

export interface ReadingInput {
  period: Period
  entries: Entry[]
  /** cores extraídas localmente das fotos e capas; as imagens nunca saem do aparelho */
  imageColors: string[]
  previous?: { title: string; reading: Reading }
  seed?: number
}

/* ───────────────────────── utilidades ───────────────────────── */

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)]

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [h, s, l]
}

function hueName(hex: string): string {
  const [h, s, l] = hexToHsl(hex)
  if (s < 0.14) return l > 0.6 ? 'prata' : 'grafite'
  if (h < 15 || h >= 345) return 'cereja'
  if (h < 40) return 'âmbar'
  if (h < 65) return 'dourado'
  if (h < 150) return 'verde-ácido'
  if (h < 195) return 'água'
  if (h < 230) return 'azul-gelo'
  if (h < 275) return 'lilás'
  if (h < 315) return 'violeta'
  return 'rosa-chiclete'
}

const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)

/* ───────────────────────── motor local ───────────────────────── */

const Y2K_PALETTES = [
  ['#c9b6ff', '#9fd8ff', '#ff9ecf', '#e8e4f0', '#2a2633'],
  ['#d7ff5a', '#9aa7b8', '#f4f1f8', '#5b6b8c', '#141418'],
  ['#ffb3d9', '#b8a1ff', '#7ee0ff', '#fdf6ff', '#24202c'],
  ['#c0c6cf', '#8b93a1', '#ff6fb5', '#e7ecf3', '#101114'],
  ['#ffd3a8', '#ff8fa3', '#a78bfa', '#f6efe9', '#1d1a22'],
]

const WORDS: Record<EntryType, string[]> = {
  album: ['repeat', 'volume alto', 'fones', 'trilha', 'lado b'],
  film: ['tela acesa', 'créditos', 'cena', 'sessão tardia'],
  series: ['maratona', 'próximo episódio', 'madrugada', 'temporada'],
  book: ['margem', 'sublinhado', 'silêncio', 'página lenta'],
  place: ['deslocamento', 'rua', 'janela', 'estrada'],
  photo: ['grão', 'flash', 'luz baixa', 'memória'],
}
const MOOD_HIGH = ['encanto', 'brilho', 'euforia mansa', 'vertigem']
const MOOD_MID = ['névoa', 'deriva', 'calmaria', 'vidro fosco']
const MOOD_LOW = ['ressaca', 'inquieto', 'pausa', 'estática']

const CORE: Record<EntryType, string[]> = {
  album: ['em repeat', 'de fones', 'em volume alto'],
  film: ['de tela acesa', 'em câmera lenta', 'de sessão tardia'],
  series: ['de maratona', 'de madrugada', 'entre episódios'],
  book: ['de margem', 'em página lenta', 'de sublinhados'],
  place: ['em trânsito', 'de rua', 'de janela de ônibus'],
  photo: ['de grão', 'de flash', 'em luz baixa'],
}
const PREFIX = ['fase', 'era', 'estação', 'temporada']

export function countByType(entries: Entry[]) {
  const c = Object.fromEntries(ENTRY_ORDER.map((t) => [t, 0])) as Record<EntryType, number>
  for (const e of entries) c[e.type]++
  return c
}

export function localReading(input: ReadingInput): Reading {
  const { entries, period, imageColors, previous } = input
  const r = rng(hash(period.id) + (input.seed ?? 0) * 7919)
  const counts = countByType(entries)
  const ranked = ENTRY_ORDER.filter((t) => counts[t] > 0).sort((a, b) => counts[b] - counts[a])
  const top = ranked[0] ?? 'photo'
  const rated = entries.filter((e) => typeof e.rating === 'number')
  const avg = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : 3.5

  const palette = (imageColors.filter(isHex).length >= 3 ? imageColors.filter(isHex).slice(0, 5) : pick(r, Y2K_PALETTES)).slice()
  while (palette.length < 5) palette.push(pick(r, Y2K_PALETTES)[palette.length])

  const hue = hueName(palette[0])
  const name = `${pick(r, PREFIX)} ${hue} ${pick(r, CORE[top])}`

  const mood = avg >= 4 ? MOOD_HIGH : avg >= 3 ? MOOD_MID : MOOD_LOW
  const words = new Set<string>()
  words.add(pick(r, WORDS[top]))
  if (ranked[1]) words.add(pick(r, WORDS[ranked[1]]))
  words.add(pick(r, mood))
  while (words.size < 4) words.add(pick(r, [...mood, ...WORDS[top]]))

  const parts: string[] = []
  if (entries.length === 0) {
    parts.push('um período ainda em branco — a leitura ganha forma conforme você registra.')
  } else {
    const lead = ranked.slice(0, 2).map((t) => `${counts[t]} ${counts[t] === 1 ? ENTRY_LABEL[t].one : ENTRY_LABEL[t].many}`)
    parts.push(`${entries.length} registros, puxados por ${lead.join(' e ')}.`)
    parts.push(avg >= 4 ? 'notas altas, quase nenhuma ressalva.' : avg >= 3 ? 'notas no meio do caminho: curiosidade mais do que paixão.' : 'notas baixas — um período de testar e descartar.')
  }
  if (previous) parts.push(`vem de “${previous.reading.name}” e troca ${pick(r, previous.reading.words)} por ${[...words][0]}.`)

  return {
    name,
    words: [...words].slice(0, 4),
    palette,
    summary: parts.join(' '),
    origin: 'local',
    edited: false,
    generatedAt: Date.now(),
  }
}

export class ReadingError extends Error {}

export const isHexColor = isHex
