import * as A from 'astronomy-engine'
import type { BirthData } from './profile'

/**
 * Cálculos astrológicos locais (astronomy-engine, MIT). Nada sai do aparelho.
 * Sem hora de nascimento, usa meio-dia e marca a Lua natal como incerta quando ela troca de signo no dia.
 * Fuso: horário local do aparelho (aproximação suficiente para signos; ascendente fica para depois).
 */

export const SIGNS = ['áries', 'touro', 'gêmeos', 'câncer', 'leão', 'virgem', 'libra', 'escorpião', 'sagitário', 'capricórnio', 'aquário', 'peixes']

type Planet = 'sol' | 'lua' | 'mercúrio' | 'vênus' | 'marte'
const BODIES: Record<Planet, A.Body> = { sol: A.Body.Sun, lua: A.Body.Moon, 'mercúrio': A.Body.Mercury, 'vênus': A.Body.Venus, marte: A.Body.Mars }

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
    for (const p of Object.keys(BODIES) as Planet[]) {
      const diff = Math.abs((((longitude(p, noon) - n.sunLon) % 360) + 540) % 360 - 180)
      const sep = 180 - diff // separação angular 0..180
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
