import { KIND_META, dotDate, phaseOf, progress } from '../lib/periods'
import type { Period } from '../lib/types'
import { Icon } from './Icon'

export function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="swatches">
      {colors.map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </div>
  )
}

/** Barra de progresso em segmentos: um por dia até 31 dias; acima disso, agrupados. */
export function SegBar({ total, elapsed }: { total: number; elapsed: number }) {
  const n = Math.min(total, 31)
  const done = Math.round((elapsed / total) * n)
  return (
    <div className="segbar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={elapsed}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={i < done - 1 ? 'on' : i === done - 1 ? 'now' : ''} />
      ))}
    </div>
  )
}

const FALLBACK = ['#2b5cff', '#0a1a4d', '#8fb0ff']

export function PeriodCard({ period, count, onOpen }: { period: Period; count: number; onOpen: () => void }) {
  const pr = progress(period)
  const phase = phaseOf(period)
  const colors = period.reading?.palette ?? FALLBACK
  const wash = `radial-gradient(circle at 15% 20%, ${colors[0]}, transparent 55%), radial-gradient(circle at 90% 80%, ${colors[1] ?? colors[0]}, transparent 55%), radial-gradient(circle at 70% 10%, ${colors[2] ?? colors[0]}, transparent 50%)`

  return (
    <button className="glass period-card interactive" onClick={onOpen} style={{ isolation: 'isolate' }}>
      <div className="wash" style={{ background: wash }} />
      <div>
        <div className="row between">
          <span className="tag">
            <span className="sparkle">✦</span> {KIND_META[period.kind].label}
            {period.status === 'closed' && ' · fechado'}
          </span>
          <Icon name="chevron" size={18} className="faint" />
        </div>
        <p className="name">{period.reading?.name ?? period.title}</p>
        {period.reading && <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{period.title}</p>}
      </div>
      <div>
        <SegBar total={pr.total} elapsed={pr.elapsed} />
        <div className="meta" style={{ marginTop: 10 }}>
          <div>
            <div className="big-dot">{String(count).padStart(2, '0')}</div>
            <div className="faint" style={{ fontSize: 12 }}>registros</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="dot" style={{ fontSize: 15 }}>
              {dotDate(period.start)} → {dotDate(period.end)}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              {phase === 'running' ? `faltam ${pr.left} ${pr.left === 1 ? 'dia' : 'dias'}` : phase === 'upcoming' ? 'ainda não começou' : 'período encerrado'}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
