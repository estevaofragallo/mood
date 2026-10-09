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

/** Arco de progresso em pontilhado, inspirado no card de meta do design system. */
export function ProgressArc({ ratio }: { ratio: number }) {
  const x = 6 + ratio * 288
  return (
    <svg className="arc" viewBox="0 0 300 26" preserveAspectRatio="none" aria-hidden>
      <line x1="6" y1="20" x2="294" y2="20" stroke="rgba(255,255,255,.28)" strokeDasharray="1 5" strokeLinecap="round" strokeWidth="1.5" />
      <path d={`M6 20 Q ${(6 + x) / 2} ${ratio > 0.02 ? -8 : 20} ${x} 20`} stroke="rgba(255,255,255,.85)" fill="none" strokeWidth="1.4" />
      <circle cx="6" cy="20" r="3.2" fill="#fff" />
      <circle cx={x} cy="20" r="4" fill="var(--lime)" style={{ filter: 'drop-shadow(0 0 6px #d7ff5a)' }} />
      <circle cx="294" cy="20" r="3.2" fill="none" stroke="rgba(255,255,255,.6)" />
    </svg>
  )
}

const FALLBACK = ['#8c74ff', '#5fb8ff', '#ff7ec2']

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
        <ProgressArc ratio={pr.ratio} />
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
