import { natal, skyToday, type Sky, type Natal } from './astro'
import type { Profile } from './profile'
import type { Entry } from './types'
import { today } from './periods'

export type PickType = 'album' | 'film' | 'series' | 'book'
export const PICK_TYPES: PickType[] = ['book', 'album', 'film', 'series']

export const MOODS = [
  { id: 'leve', label: 'leve' },
  { id: 'intenso', label: 'intenso' },
  { id: 'nostalgico', label: 'nostálgico' },
  { id: 'introspectivo', label: 'introspectivo' },
  { id: 'inquieto', label: 'inquieto' },
  { id: 'cansado', label: 'cansado' },
  { id: 'romantico', label: 'romântico' },
  { id: 'curioso', label: 'curioso' },
] as const
export type MoodId = (typeof MOODS)[number]['id']
export const moodLabel = (m?: MoodId) => MOODS.find((x) => x.id === m)?.label

export interface Pick {
  type: PickType
  title: string
  creator?: string
  year?: string
  /** por que combina com a pessoa */
  why: string
  coverUrl?: string
}

export interface Daily {
  date: string
  mood?: MoodId
  want: PickType | 'any'
  pick: Pick
  alternates: Pick[]
  /** linha do céu do dia (modo astral) */
  sky?: string
  origin: 'ai' | 'local'
  round: number
}

/* ───────── armazenamento ───────── */

const KEY = 'moody.daily'
const KNOWN = 'moody.daily.known'

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignora */
  }
}

export function loadDaily(date = today()): Daily | null {
  return read<Record<string, Daily>>(KEY, {})[date] ?? null
}
export function saveDaily(d: Daily) {
  const all = read<Record<string, Daily>>(KEY, {})
  all[d.date] = d
  const keep = Object.keys(all).sort().slice(-60) // guarda só os últimos 60 dias
  write(KEY, Object.fromEntries(keep.map((k) => [k, all[k]])))
}
export function pastPicks(): Pick[] {
  return Object.values(read<Record<string, Daily>>(KEY, {})).flatMap((d) => [d.pick])
}
export function markKnown(title: string) {
  const list = read<string[]>(KNOWN, [])
  write(KNOWN, [...new Set([...list, norm(title)])].slice(-300))
}
export function clearDaily() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(KNOWN)
  } catch {
    /* ignora */
  }
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/** títulos que não devem ser indicados: já registrados, favoritos, já indicados, já conhecidos */
export function excluded(entries: Entry[], profile: Profile | null, extra: string[] = []): Set<string> {
  return new Set(
    [
      ...entries.map((e) => e.title),
      ...(profile?.favorites.map((f) => f.title) ?? []),
      ...pastPicks().map((p) => p.title),
      ...extra,
    ].map(norm).concat(read<string[]>(KNOWN, [])),
  )
}

/* ───────── céu do dia ───────── */

export interface AstroContext {
  natal: Natal
  sky: Sky
  line: string
}

export function astroContext(profile: Profile | null): AstroContext | null {
  if (profile?.mode !== 'astral' || !profile.birth?.date) return null
  const n = natal(profile.birth)
  const sky = skyToday(n)
  const line = [`${sky.phase} em ${sky.moonSign}`, sky.transits[0]].filter(Boolean).join(' · ')
  return { natal: n, sky, line }
}

/* ───────── motor local (sem IA) ───────── */

type Seed = [PickType, string, string, string, MoodId[], string]
const SEEDS: Seed[] = [
  ['album', 'Acabou Chorare', 'Novos Baianos', '1972', ['leve', 'nostalgico'], 'violão solto e sol de quintal'],
  ['album', 'Clube da Esquina', 'Milton Nascimento e Lô Borges', '1972', ['introspectivo', 'nostalgico'], 'estrada, amizade e horizonte largo'],
  ['album', 'In Rainbows', 'Radiohead', '2007', ['introspectivo', 'romantico'], 'calor contido, quase um abraço'],
  ['album', 'Discovery', 'Daft Punk', '2001', ['leve', 'inquieto'], 'brilho de fliperama e otimismo'],
  ['album', 'Construção', 'Chico Buarque', '1971', ['intenso', 'curioso'], 'arranjos que crescem até explodir'],
  ['album', 'Elis & Tom', 'Elis Regina e Tom Jobim', '1974', ['cansado', 'romantico'], 'conversa macia de fim de tarde'],
  ['album', 'Carrie & Lowell', 'Sufjan Stevens', '2015', ['cansado', 'introspectivo'], 'sussurro, memória e luto bonito'],
  ['album', 'SOS', 'SZA', '2022', ['romantico', 'intenso'], 'confissão em volume alto'],
  ['album', 'Kid A', 'Radiohead', '2000', ['curioso', 'inquieto'], 'eletrônico gelado e estranho'],
  ['album', 'AmarElo', 'Emicida', '2019', ['intenso', 'curioso'], 'força coletiva e cura'],
  ['film', 'Amor à Flor da Pele', 'Wong Kar-wai', '2000', ['romantico', 'introspectivo'], 'desejo em câmera lenta e neon'],
  ['film', 'Central do Brasil', 'Walter Salles', '1998', ['nostalgico', 'intenso'], 'estrada, cartas e reencontro'],
  ['film', 'Tudo em Todo o Lugar ao Mesmo Tempo', 'Daniel Kwan e Daniel Scheinert', '2022', ['inquieto', 'intenso'], 'caos multicolorido com coração'],
  ['film', 'Frances Ha', 'Noah Baumbach', '2012', ['leve', 'inquieto'], 'preto e branco, corrida pela rua'],
  ['film', 'Meu Vizinho Totoro', 'Hayao Miyazaki', '1988', ['cansado', 'leve'], 'chuva, floresta e colo'],
  ['film', 'Paterson', 'Jim Jarmusch', '2016', ['cansado', 'introspectivo'], 'rotina como poema'],
  ['film', 'Corra!', 'Jordan Peele', '2017', ['intenso', 'curioso'], 'tensão que não solta'],
  ['film', 'Antes do Amanhecer', 'Richard Linklater', '1995', ['romantico', 'leve'], 'uma noite inteira de conversa'],
  ['film', 'Que Horas Ela Volta?', 'Anna Muylaert', '2015', ['curioso', 'intenso'], 'a casa como campo de batalha'],
  ['film', 'Aftersun', 'Charlotte Wells', '2022', ['nostalgico', 'introspectivo'], 'férias lembradas pela metade'],
  ['series', 'Fleabag', 'Phoebe Waller-Bridge', '2016', ['leve', 'intenso'], 'humor ácido olhando pra câmera'],
  ['series', 'Normal People', 'Sally Rooney e Alice Birch', '2020', ['romantico', 'introspectivo'], 'silêncios que dizem tudo'],
  ['series', 'Ruptura', 'Dan Erickson', '2022', ['curioso', 'inquieto'], 'escritório como labirinto'],
  ['series', 'Atlanta', 'Donald Glover', '2016', ['curioso', 'leve'], 'surreal no meio do cotidiano'],
  ['series', 'Mad Men', 'Matthew Weiner', '2007', ['nostalgico', 'introspectivo'], 'elegância e vazio dos anos 60'],
  ['series', 'Abbott Elementary', 'Quinta Brunson', '2021', ['cansado', 'leve'], 'conforto em episódios curtos'],
  ['series', 'O Urso', 'Christopher Storer', '2022', ['inquieto', 'intenso'], 'cozinha em ritmo de pânico'],
  ['book', 'A Hora da Estrela', 'Clarice Lispector', '1977', ['introspectivo', 'intenso'], 'curto e devastador'],
  ['book', 'Torto Arado', 'Itamar Vieira Junior', '2019', ['intenso', 'nostalgico'], 'terra, irmãs e memória'],
  ['book', 'Só Garotos', 'Patti Smith', '2010', ['nostalgico', 'romantico'], 'nova york, arte e juventude'],
  ['book', 'O Ano do Pensamento Mágico', 'Joan Didion', '2005', ['introspectivo', 'cansado'], 'luto escrito com precisão'],
  ['book', 'Klara e o Sol', 'Kazuo Ishiguro', '2021', ['curioso', 'introspectivo'], 'ternura vista de fora'],
  ['book', 'Cem Anos de Solidão', 'Gabriel García Márquez', '1967', ['nostalgico', 'curioso'], 'família, tempo e encanto'],
  ['book', 'Grande Sertão: Veredas', 'João Guimarães Rosa', '1956', ['intenso', 'curioso'], 'travessia que muda a língua'],
  ['book', 'Minha Vida de Menina', 'Helena Morley', '1942', ['leve', 'nostalgico'], 'diário de infância, riso fácil'],
  ['book', 'O Avesso da Pele', 'Jeferson Tenório', '2020', ['intenso', 'introspectivo'], 'pai, filho e o que fica'],
  ['book', 'Os Despossuídos', 'Ursula K. Le Guin', '1974', ['curioso', 'inquieto'], 'utopia com rachaduras'],
]

function rand(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296)
}

export function localDaily(opts: { mood?: MoodId; want: PickType | 'any'; skip: Set<string>; profile: Profile | null; round: number; astro: AstroContext | null }): Daily | null {
  const r = rand(`${today()}-${opts.round}-${opts.mood ?? ''}-${opts.want}`)
  const pool = SEEDS.filter(([t, title]) => (opts.want === 'any' || t === opts.want) && !opts.skip.has(norm(title)))
  if (!pool.length) return null
  const scored = pool
    .map((s) => ({ s, score: (opts.mood && s[4].includes(opts.mood) ? 2 : 0) + r() }))
    .sort((a, b) => b.score - a.score)
  const toPick = ([type, title, creator, year, moods, tag]: Seed): Pick => {
    const fav = opts.profile?.favorites.find((f) => f.type === type)
    const m = opts.mood && moods.includes(opts.mood) ? `para um dia ${moodLabel(opts.mood)}: ` : ''
    return { type, title, creator, year, why: `${m}${tag}.${fav ? ` se “${fav.title}” ficou em você, vale tentar.` : ''}` }
  }
  return {
    date: today(),
    mood: opts.mood,
    want: opts.want,
    pick: toPick(scored[0].s),
    alternates: scored.slice(1, 3).map((x) => toPick(x.s)),
    sky: opts.astro?.line,
    origin: 'local',
    round: opts.round,
  }
}
