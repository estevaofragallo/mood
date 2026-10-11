import { useState } from 'react'
import { useStore } from '../store'
import { Swatches } from '../components/PeriodCard'
import { KIND_META, dotDate, phaseOf } from '../lib/periods'
import type { PeriodKind } from '../lib/types'

const FILTERS: (PeriodKind | 'all')[] = ['all', '1m', '3m', '6m', '1y', 'week', 'trip', 'custom']

export function Eras({ openPeriod }: { openPeriod: (id: string) => void }) {
  const { periods, entriesOf } = useStore()
  const [filter, setFilter] = useState<PeriodKind | 'all'>('all')
  const list = periods
    .filter((p) => filter === 'all' || p.kind === filter)
    .sort((a, b) => b.start.localeCompare(a.start) || a.end.localeCompare(b.end))
  const kinds = new Set(periods.map((p) => p.kind))

  return (
    <div className="screen">
      <header className="topbar">
        <span className="title">eras</span>
        <span className="dot faint" style={{ fontSize: 14 }}>{String(periods.filter((p) => p.status === 'closed').length).padStart(2, '0')} fechadas</span>
      </header>
      <p className="muted" style={{ marginTop: -8, fontSize: 14 }}>quem você foi, fase a fase. nenhum rótulo é definitivo.</p>

      {periods.length > 0 && (
        <div className="chips" style={{ margin: '18px -16px 22px' }}>
          {FILTERS.filter((f) => f === 'all' || kinds.has(f)).map((f) => (
            <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'todas' : KIND_META[f].label}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="glass empty">
          <p className="big">o arquivo começa vazio</p>
          <p className="muted" style={{ margin: 0 }}>cada período fechado vira uma era aqui. com o tempo, dá para ver como você mudou.</p>
        </div>
      ) : (
        <div className="timeline">
          {list.map((p) => {
            const n = entriesOf(p).length
            return (
              <div key={p.id} className="era" style={{ ['--era-c' as string]: p.reading?.palette[0] ?? 'var(--accent)' }}>
                <button className="glass card interactive" style={{ width: '100%', textAlign: 'left', borderRadius: 26, opacity: p.status === 'open' ? 0.85 : 1 }} onClick={() => openPeriod(p.id)}>
                  <div className="row between">
                    <span className="dot faint" style={{ fontSize: 13 }}>{dotDate(p.start)} → {dotDate(p.end)}</span>
                    <span className="tag">{KIND_META[p.kind].label}{p.status === 'open' ? (phaseOf(p) === 'ended' ? ' · a fechar' : phaseOf(p) === 'upcoming' ? ' · em breve' : ' · em curso') : ''}</span>
                  </div>
                  <p className="serif" style={{ fontSize: 'calc(30px * var(--display-scale))', margin: '12px 0 6px' }}>{p.reading?.name ?? p.title}</p>
                  {p.reading && <p className="faint" style={{ margin: 0, fontSize: 13 }}>{p.title} · {p.reading.words.join(' · ')}</p>}
                  <div className="row between" style={{ marginTop: 14 }}>
                    {p.reading ? <Swatches colors={p.reading.palette} /> : <span className="faint" style={{ fontSize: 12 }}>sem leitura ainda</span>}
                    <span className="dot" style={{ fontSize: 14 }}>{String(n).padStart(2, '0')} reg.</span>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
