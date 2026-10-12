import type { Period, PeriodKind } from './types'

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface KindMeta {
  kind: PeriodKind
  label: string
  short: string
  hint: string
  months?: number
  days?: number
}

/** Periodicidades fixas: as sugeridas. */
export const FIXED_KINDS: KindMeta[] = [
  { kind: '1m', label: '1 mês', short: '1m', hint: 'o recap clássico, todo mês', months: 1 },
  { kind: '3m', label: '3 meses', short: '3m', hint: 'uma estação inteira', months: 3 },
  { kind: '6m', label: '6 meses', short: '6m', hint: 'um semestre de fases', months: 6 },
  { kind: '1y', label: '1 ano', short: '1a', hint: 'a era completa', months: 12 },
]

/** Periodicidades personalizadas. */
export const CUSTOM_KINDS: KindMeta[] = [
  { kind: 'week', label: 'semanal', short: '7d', hint: 'sete dias, um recorte curto', days: 7 },
  { kind: 'trip', label: 'viagem', short: '✈', hint: 'do embarque à volta' },
  { kind: 'custom', label: 'livre', short: '∞', hint: 'você define início, fim e nome' },
]

export const KIND_META: Record<PeriodKind, KindMeta> = Object.fromEntries(
  [...FIXED_KINDS, ...CUSTOM_KINDS].map((k) => [k.kind, k]),
) as Record<PeriodKind, KindMeta>

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toISO(new Date())

export function firstOfMonth(d = new Date()): string {
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Calcula o fim (inclusivo) a partir do início, para períodos de duração fixa. */
export function computeEnd(kind: PeriodKind, start: string): string | null {
  const meta = KIND_META[kind]
  const s = fromISO(start)
  if (meta.months) return toISO(new Date(s.getFullYear(), s.getMonth() + meta.months, s.getDate() - 1))
  if (meta.days) return toISO(new Date(s.getFullYear(), s.getMonth(), s.getDate() + meta.days - 1))
  return null
}

const yy = (d: Date) => `'${String(d.getFullYear()).slice(2)}`

export function defaultTitle(kind: PeriodKind, start: string, end: string, extra = ''): string {
  const s = fromISO(start)
  const e = fromISO(end)
  switch (kind) {
    case '1m':
      return s.getDate() === 1 ? `${MONTHS[s.getMonth()]} ${yy(s)}` : `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} → ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`
    case '3m':
    case '6m':
      return `${MONTHS_SHORT[s.getMonth()]} → ${MONTHS_SHORT[e.getMonth()]} ${yy(e)}`
    case '1y':
      return s.getMonth() === 0 && s.getDate() === 1 ? `${s.getFullYear()}` : `${MONTHS_SHORT[s.getMonth()]} ${yy(s)} → ${MONTHS_SHORT[e.getMonth()]} ${yy(e)}`
    case 'week':
      return `semana de ${s.getDate()} ${MONTHS_SHORT[s.getMonth()]}`
    case 'trip':
      return extra ? `viagem · ${extra.toLowerCase()}` : 'viagem'
    case 'custom':
      return extra.toLowerCase() || 'período livre'
  }
}

export function formatRange(start: string, end: string): string {
  const f = (s: string) => {
    const d = fromISO(s)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`
  }
  return `${f(start)} — ${f(end)}`
}

export function dotDate(s: string): string {
  const d = fromISO(s)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`
}

const DAY = 86_400_000
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / DAY)
}

export function progress(p: Pick<Period, 'start' | 'end'>, ref = today()) {
  const total = daysBetween(p.start, p.end) + 1
  const elapsed = Math.min(Math.max(daysBetween(p.start, ref) + 1, 0), total)
  return { total, elapsed, left: total - elapsed, ratio: total ? elapsed / total : 0 }
}

export const inRange = (date: string, p: Pick<Period, 'start' | 'end'>) => date >= p.start && date <= p.end

export function phaseOf(p: Period, ref = today()): 'upcoming' | 'running' | 'ended' {
  if (ref < p.start) return 'upcoming'
  if (ref > p.end) return 'ended'
  return 'running'
}
