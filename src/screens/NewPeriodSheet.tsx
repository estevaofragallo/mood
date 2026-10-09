import { useMemo, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { uid } from '../lib/db'
import { CUSTOM_KINDS, FIXED_KINDS, KIND_META, computeEnd, defaultTitle, firstOfMonth, formatRange, today, daysBetween } from '../lib/periods'
import type { PeriodKind } from '../lib/types'

function defaultStart(kind: PeriodKind) {
  return ['1m', '3m', '6m'].includes(kind) ? firstOfMonth() : kind === '1y' ? firstOfMonth() : today()
}

export function NewPeriodSheet({ onClose, onCreated, initialKind = '1m' }: { onClose: () => void; onCreated: (id: string) => void; initialKind?: PeriodKind }) {
  const { savePeriod } = useStore()
  const toast = useToast()
  const [kind, setKind] = useState<PeriodKind>(initialKind)
  const [start, setStart] = useState(defaultStart(initialKind))
  const [endManual, setEndManual] = useState(today())
  const [label, setLabel] = useState('')
  const [customTitle, setCustomTitle] = useState('')

  const fixedEnd = computeEnd(kind, start)
  const end = fixedEnd ?? endManual
  const valid = end >= start && (kind !== 'custom' || label.trim().length > 0)
  const autoTitle = useMemo(() => defaultTitle(kind, start, end, label), [kind, start, end, label])

  const pickKind = (k: PeriodKind) => {
    setKind(k)
    setStart(defaultStart(k))
    if (!computeEnd(k, defaultStart(k))) setEndManual(today())
  }

  async function create() {
    const id = uid()
    await savePeriod({ id, kind, title: customTitle.trim().toLowerCase() || autoTitle, start, end, status: 'open', createdAt: Date.now() })
    toast('período aberto ✦')
    onCreated(id)
  }

  return (
    <Sheet title="abrir um período" onClose={onClose}>
      <div className="stack" style={{ gap: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>sugeridos</div>
          <div className="kind-grid">
            {FIXED_KINDS.map((k) => (
              <button key={k.kind} className={`glass kind interactive${kind === k.kind ? ' on' : ''}`} onClick={() => pickKind(k.kind)}>
                <span className="k-num">{k.short}</span>
                <span>
                  <b style={{ display: 'block' }}>{k.label}</b>
                  <small className="faint">{k.hint}</small>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>personalizados</div>
          <div className="kind-row">
            {CUSTOM_KINDS.map((k) => (
              <button key={k.kind} className={`glass kind interactive${kind === k.kind ? ' on' : ''}`} onClick={() => pickKind(k.kind)}>
                <span className="k-num">{k.short}</span>
                <b style={{ fontSize: 14 }}>{k.label}</b>
              </button>
            ))}
          </div>
          <p className="note" style={{ margin: '8px 4px 0' }}>{KIND_META[kind].hint}</p>
        </div>

        {(kind === 'trip' || kind === 'custom') && (
          <label className="field">
            <span>{kind === 'trip' ? 'destino' : 'nome do período'}</span>
            <input className="input" placeholder={kind === 'trip' ? 'lisboa, chapada, tóquio…' : 'mudança, férias, semestre 2…'} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
        )}

        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: 1 }}>
            <span>início</span>
            <input className="input" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>fim{fixedEnd ? ' (automático)' : ''}</span>
            <input className="input" type="date" value={end} disabled={!!fixedEnd} min={start} onChange={(e) => e.target.value && setEndManual(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>título no recap</span>
          <input className="input" placeholder={autoTitle} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
        </label>

        <div className="glass card tight row between">
          <div>
            <div className="serif" style={{ fontSize: 22 }}>{customTitle.trim().toLowerCase() || autoTitle}</div>
            <div className="dot faint" style={{ fontSize: 13 }}>{formatRange(start, end)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="dot" style={{ fontSize: 30, fontWeight: 900 }}>{end >= start ? daysBetween(start, end) + 1 : '--'}</div>
            <small className="faint">dias</small>
          </div>
        </div>

        <p className="note" style={{ margin: 0 }}>
          os períodos são janelas sobre o seu diário: tudo que você registrar entre essas datas entra no recap — inclusive o que já foi registrado antes. períodos podem se sobrepor (um mês dentro de um trimestre, uma viagem dentro do ano).
        </p>

        <button className="btn primary block" disabled={!valid} onClick={create}>
          abrir período
        </button>
      </div>
    </Sheet>
  )
}
