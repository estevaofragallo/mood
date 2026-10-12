import * as A from 'astronomy-engine'
import type { BirthData } from './profile'

/**
 * Cálculos astrológicos locais (astronomy-engine, MIT). Nada sai do aparelho.
 * Sem hora de nascimento, usa meio-dia e marca a Lua natal como incerta quando ela troca de signo no dia.
 * Fuso: horário local do aparelho (aproximação suficiente para signos; ascendente fica para depois).
 */

export const SIGNS = ['áries', 'touro', 'gêmeos', 'câncer', 'leão', 'virgem', 'libra', 'escorpião', 'sagitário', 'capricórnio', 'aquário', 'peixes']

type Planet = 'sol' | 'lua' | 'mercúrio' | 'vênus' | 'marte' | 'júpiter' | 'saturno'
const BODIES: Record<Planet, A.Body> = { sol: A.Body.Sun, lua: A.Body.Moon, 'mercúrio': A.Body.Mercury, 'vênus': A.Body.Venus, marte: A.Body.Mars, 'júpiter': A.Body.Jupiter, saturno: A.Body.Saturn }
/** planetas usados no céu do dia (os rápidos) */
const DAILY: Planet[] = ['sol', 'lua', 'mercúrio', 'vênus', 'marte']

export function longitude(p: Planet, date: Date): number {
  if (p === 'sol') return A.SunPosition(date).elon
  if (p === 'lua') return A.EclipticGeoMoon(date).lon
  return A.Ecliptic(A.GeoVector(BODIES[p], date, true)).elon
}
const signOf = (lon: number) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)]

function birthDate(b: BirthData, time = b.time ?? '12:00') {
  const [y, m, d] = b.date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

export interface Natal {
  sun: string
  moon: string
  /** lua natal incerta (sem hora e com troca de signo no dia) */
  moonAlt?: string
  sunLon: number
}

export function natal(b: BirthData): Natal {
  const at = birthDate(b)
  const sunLon = longitude('sol', at)
  const moon = signOf(longitude('lua', at))
  let moonAlt: string | undefined
  if (!b.time) {
    const a = signOf(longitude('lua', birthDate(b, '00:00')))
    const z = signOf(longitude('lua', birthDate(b, '23:59')))
    if (a !== z) moonAlt = a === moon ? z : a
  }
  return { sun: signOf(sunLon), moon, moonAlt, sunLon }
}

const PHASES: [number, string][] = [
  [22.5, 'lua nova'], [67.5, 'lua crescente'], [112.5, 'quarto crescente'], [157.5, 'lua gibosa crescente'],
  [202.5, 'lua cheia'], [247.5, 'lua gibosa minguante'], [292.5, 'quarto minguante'], [337.5, 'lua minguante'], [360, 'lua nova'],
]

/** Separação angular 0..180 entre duas longitudes (0 = conjunção, 180 = oposição). */
export const separation = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180)

const ASPECTS: [number, string][] = [[0, 'em conjunção com'], [60, 'em sextil com'], [90, 'em quadratura com'], [120, 'em trígono com'], [180, 'em oposição a']]

export interface Sky {
  moonSign: string
  phase: string
  sunSign: string
  /** aspectos do céu de hoje ao sol natal, do mais exato ao menos */
  transits: string[]
}

export function skyToday(n: Natal | null, date = new Date()): Sky {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  const angle = A.MoonPhase(noon)
  const phase = PHASES.find(([lim]) => angle < lim)![1]
  const transits: { text: string; orb: number }[] = []
  if (n) {
    for (const p of DAILY) {
      const sep = separation(longitude(p, noon), n.sunLon)
      for (const [deg, label] of ASPECTS) {
        const orb = Math.abs(sep - deg)
        if (orb <= (p === 'lua' ? 6 : 3)) transits.push({ text: `${p === 'sol' ? 'o sol' : p === 'lua' ? 'a lua' : p} ${label} seu sol`, orb })
      }
    }
  }
  return {
    moonSign: signOf(longitude('lua', noon)),
    sunSign: signOf(longitude('sol', noon)),
    phase,
    transits: transits.sort((a, b) => a.orb - b.orb).map((t) => t.text).slice(0, 3),
  }
}

export interface AstroContext {
  natal: Natal
  sky: Sky
  line: string
}

export function astroContext(birth: BirthData): AstroContext {
  const n = natal(birth)
  const sky = skyToday(n)
  return { natal: n, sky, line: [`${sky.phase} em ${sky.moonSign}`, sky.transits[0]].filter(Boolean).join(' · ') }
}

/* ───────── céu de um período ───────── */

export interface PeriodSky {
  lunations: { date: string; kind: 'lua nova' | 'lua cheia'; sign: string }[]
  sunSigns: string[]
  retro: { planet: string; from: string; to: string }[]
  aspects: { text: string; date: string }[]
  /** frases prontas, em ordem cronológica de relevância */
  facts: string[]
  /** resumo em uma linha */
  line: string
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
const DAY = 86_400_000


export function periodSky(start: string, end: string, n: Natal | null): PeriodSky {
  const from = parse(start)
  const to = new Date(parse(end).getTime() + DAY / 2)
  const days: Date[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) days.push(new Date(t))

  // lunações
  const lunations: PeriodSky['lunations'] = []
  for (const [angle, kind] of [[0, 'lua nova'], [180, 'lua cheia']] as const) {
    let cursor = new Date(from.getTime() - DAY / 2)
    for (;;) {
      const span = (to.getTime() - cursor.getTime()) / DAY
      if (span <= 0) break
      const hit = A.SearchMoonPhase(angle, cursor, span)
      if (!hit) break
      const date = hit.date
      lunations.push({ date: iso(date), kind, sign: signOf(longitude('lua', date)) })
      cursor = new Date(date.getTime() + DAY)
    }
  }
  lunations.sort((a, b) => a.date.localeCompare(b.date))

  // signos percorridos pelo sol
  const sunSigns = [...new Set(days.map((d) => signOf(longitude('sol', d))))]

  // retrogradações (movimento diário negativo)
  const retro: PeriodSky['retro'] = []
  for (const p of ['mercúrio', 'vênus', 'marte'] as Planet[]) {
    let runStart: string | null = null
    let prev = longitude(p, new Date(from.getTime() - DAY))
    days.forEach((d, i) => {
      const lon = longitude(p, d)
      const delta = ((lon - prev + 540) % 360) - 180
      prev = lon
      if (delta < 0 && !runStart) runStart = iso(d)
      if ((delta >= 0 || i === days.length - 1) && runStart) {
        retro.push({ planet: p, from: runStart, to: iso(delta >= 0 ? days[i - 1] ?? d : d) })
        runStart = null
      }
    })
  }

  // aspectos exatos (orbe ≤ 1,5°) de planetas lentos ao sol natal
  const aspects: PeriodSky['aspects'] = []
  if (n) {
    for (const p of ['vênus', 'marte', 'júpiter', 'saturno'] as Planet[]) {
      const seps = days.map((d) => separation(longitude(p, d), n.sunLon))
      for (const [deg, label] of ASPECTS) {
        let best = Infinity
        let at = -1
        seps.forEach((s, i) => {
          const orb = Math.abs(s - deg)
          if (orb < best) [best, at] = [orb, i]
        })
        if (best <= 1.5) aspects.push({ text: `${p} ${label} seu sol`, date: iso(days[at]) })
      }
    }
    aspects.sort((a, b) => a.date.localeCompare(b.date))
  }

  const news = lunations.filter((l) => l.kind === 'lua nova').length
  const fulls = lunations.length - news
  const lunationFacts =
    lunations.length <= 4
      ? lunations.map((l) => `${l.kind} em ${l.sign} (${dm(l.date)})`)
      : [`${news} ${news === 1 ? 'lua nova' : 'luas novas'} e ${fulls} ${fulls === 1 ? 'lua cheia' : 'luas cheias'}`]
  const retroText = (r: PeriodSky['retro'][number]) => {
    if (r.from === r.to) return `${r.planet} estaciona (${dm(r.from)})`
    const a = r.from === start ? 'desde antes do período' : `de ${dm(r.from)}`
    const b = r.to === end ? 'até o fim do período' : `a ${dm(r.to)}`
    return `${r.planet} retrógrado ${a} ${b}`
  }
  const facts = [
    ...lunationFacts,
    ...retro.map(retroText),
    ...aspects.map((a) => `${a.text} (${dm(a.date)})`),
    sunSigns.length > 1 ? `o sol passa por ${sunSigns.join(', ')}` : `o sol em ${sunSigns[0]}`,
  ]
  const retroPlanets = [...new Set(retro.map((r) => r.planet))]
  const line = [
    news ? `${news} ${news === 1 ? 'lua nova' : 'luas novas'}` : '',
    fulls ? `${fulls} ${fulls === 1 ? 'lua cheia' : 'luas cheias'}` : '',
    retroPlanets.length ? `${retroPlanets.join(' e ')} ${retroPlanets.length > 1 ? 'retrógrados' : 'retrógrado'}` : '',
    aspects[0]?.text ?? '',
  ].filter(Boolean).join(' · ')

  return { lunations, sunSigns, retro, aspects, facts, line }
}
