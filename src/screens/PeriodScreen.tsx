import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { Icon, type IconName } from '../components/Icon'
import { Cover } from '../components/Cover'
import { Rating } from '../components/Rating'
import { Sheet } from '../components/Sheet'
import { ProgressArc } from '../components/PeriodCard'
import { useToast } from '../components/Toast'
import { ReadingEditor } from './ReadingEditor'
import { db } from '../lib/db'
import { dominantColors } from '../lib/images'
import { KIND_META, dotDate, inRange, phaseOf, progress, today } from '../lib/periods'
import { ReadingError, localReading, type ReadingInput } from '../lib/reading'
import { loadSettings } from '../lib/settings'
import { ENTRY_LABEL, ENTRY_ORDER, type Entry, type EntryType, type Period, type Reading } from '../lib/types'

interface Props {
  period: Period
  back: () => void
  share: () => void
  addEntry: (date: string) => void
  editEntry: (e: Entry) => void
}

export function PeriodScreen({ period, back, share, addEntry, editEntry }: Props) {
  const { entriesOf, periods, savePeriod, deletePeriod } = useStore()
  const toast = useToast()
  const entries = entriesOf(period)
  const [filter, setFilter] = useState<EntryType | 'all'>('all')
  const [generating, setGenerating] = useState(false)
  const [editingReading, setEditingReading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [seed, setSeed] = useState(0)

  const pr = progress(period)
  const phase = phaseOf(period)
  const closed = period.status === 'closed'
  const reading = period.reading
  const hasKey = !!loadSettings().apiKey

  const counts = useMemo(() => {
    const c = new Map<EntryType, number>()
    entries.forEach((e) => c.set(e.type, (c.get(e.type) ?? 0) + 1))
    return c
  }, [entries])
  const shown = filter === 'all' ? entries : entries.filter((e) => e.type === filter)

  const previous = useMemo(() => {
    return periods
      .filter((p) => p.id !== period.id && p.reading && p.end < period.start)
      .sort((a, b) => b.end.localeCompare(a.end))[0]
  }, [periods, period])

  async function generate(): Promise<Reading> {
    setGenerating(true)
    try {
      const blobs: Blob[] = []
      for (const e of entries) if (e.imageId) {
        const b = await db.getBlob(e.imageId)
        if (b) blobs.push(b)
      }
      const input: ReadingInput = {
        period,
        entries,
        imageColors: await dominantColors(blobs),
        previous: previous?.reading ? { title: previous.title, reading: previous.reading } : undefined,
        seed: seed + 1,
      }
      setSeed((s) => s + 1)
      let r: Reading
      if (hasKey) {
        try {
          const { aiReading } = await import('../lib/reading-ai')
          r = await aiReading(input)
        } catch (err) {
          toast(`${err instanceof ReadingError ? err.message : 'falha na IA'} — usei a leitura local`)
          r = localReading(input)
        }
      } else r = localReading(input)
      await savePeriod({ ...period, reading: r })
      return r
    } finally {
      setGenerating(false)
    }
  }

  async function toggleClose() {
    if (closed) {
      await savePeriod({ ...period, status: 'open', closedAt: undefined })
      toast('período reaberto')
      return
    }
    const r = period.reading ?? (await generate())
    await savePeriod({ ...period, reading: r, status: 'closed', closedAt: Date.now() })
    toast('recap fechado — virou era ✦')
  }

  const palette = reading?.palette ?? ['#8c74ff', '#5fb8ff', '#ff7ec2']
  const defaultDate = inRange(today(), period) ? today() : phase === 'upcoming' ? period.start : period.end

  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={back} aria-label="voltar"><Icon name="back" size={20} /></button>
        <span className="tag"><span className="sparkle">✦</span> {KIND_META[period.kind].label}{closed ? ' · era fechada' : ''}</span>
        <button className="icon-btn" onClick={() => setConfirmDelete(true)} aria-label="excluir período"><Icon name="trash" size={18} /></button>
      </header>

      <div style={{ position: 'relative', marginBottom: 6 }}>
        <div style={{ position: 'absolute', inset: '-40px -16px auto', height: 260, zIndex: -1, filter: 'blur(50px)', opacity: 0.45, background: `radial-gradient(circle at 20% 40%, ${palette[0]}, transparent 60%), radial-gradient(circle at 85% 30%, ${palette[1]}, transparent 55%)` }} />
        <h1 className="serif" style={{ fontWeight: 400, fontSize: 46, lineHeight: 1, margin: '6px 0 8px', letterSpacing: '-0.015em' }}>{period.title}</h1>
        <div className="row between">
          <span className="dot muted" style={{ fontSize: 15 }}>{dotDate(period.start)} → {dotDate(period.end)}</span>
          <span className="faint" style={{ fontSize: 12 }}>
            {phase === 'running' ? `dia ${pr.elapsed} de ${pr.total}` : phase === 'upcoming' ? 'começa em breve' : `${pr.total} dias`}
          </span>
        </div>
        <ProgressArc ratio={pr.ratio} />
      </div>

      {/* leitura */}
      <section className="section" style={{ marginTop: 22 }}>
        {reading ? (
          <div className="glass reading" style={{ isolation: 'isolate' }}>
            <div style={{ position: 'absolute', inset: 0, zIndex: -1, opacity: 0.35, filter: 'blur(40px)', background: `radial-gradient(circle at 10% 10%, ${palette[0]}, transparent 60%), radial-gradient(circle at 100% 100%, ${palette[2] ?? palette[0]}, transparent 60%)` }} />
            <div className="row between">
              <span className="eyebrow">leitura do período</span>
              <span className="faint" style={{ fontSize: 11 }}>{reading.origin === 'ai' ? 'sugerida por IA' : 'leitura local'}{reading.edited ? ' · editada' : ''}</span>
            </div>
            <p className="r-name">{reading.name}</p>
            <div className="r-words">{reading.words.map((w) => <span key={w}>{w}</span>)}</div>
            {reading.summary && <p className="r-sum">{reading.summary}</p>}
            <div className="palette-bar">{reading.palette.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
            {!closed && (
              <div className="row" style={{ marginTop: 18, gap: 8 }}>
                <button className="btn glassy sm" onClick={() => setEditingReading(true)}><Icon name="edit" size={16} /> editar</button>
                <button className="btn ghost sm" disabled={generating} onClick={() => generate()}>
                  {generating ? <span className="pending"><i /><i /><i /></span> : <><Icon name="refresh" size={16} /> refazer</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass card" style={{ textAlign: 'center', padding: '28px 22px' }}>
            <Icon name="sparkle" size={30} className="sparkle" />
            <p className="serif" style={{ fontSize: 26, margin: '8px 0 6px' }}>quem você foi aqui?</p>
            <p className="muted" style={{ fontSize: 14, margin: '0 0 18px' }}>
              {hasKey ? 'a IA sugere um nome para a fase, palavras e uma paleta. você edita como quiser.' : 'gere uma leitura local agora, ou conecte a IA em ajustes para leituras mais finas.'}
            </p>
            <button className="btn iri" disabled={generating || closed} onClick={() => generate()}>
              {generating ? <span className="pending"><i /><i /><i /></span> : <><Icon name="sparkle" size={18} /> gerar leitura</>}
            </button>
          </div>
        )}
      </section>

      {/* registros */}
      <section className="section">
        <div className="section-head">
          <h2>registros</h2>
          {!closed && (
            <button className="btn plus sm" style={{ height: 38, paddingLeft: 14 }} onClick={() => addEntry(defaultDate)}>
              registrar <span className="plus-dot" style={{ width: 28, height: 28 }}><Icon name="plus" size={15} /></span>
            </button>
          )}
        </div>
        {entries.length > 0 && (
          <div className="chips" style={{ marginBottom: 14 }}>
            <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>tudo · {entries.length}</button>
            {ENTRY_ORDER.filter((t) => counts.get(t)).map((t) => (
              <button key={t} className={`chip${filter === t ? ' on' : ''}`} onClick={() => setFilter(t)}>
                <Icon name={t as IconName} size={15} /> {counts.get(t)}
              </button>
            ))}
          </div>
        )}
        {entries.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>nada registrado entre essas datas ainda.</p>
        ) : filter === 'photo' || filter === 'all' ? (
          <div className="grid">
            {shown.map((e, i) => (
              <button key={e.id} className={`tile${e.type === 'photo' ? ' photo' : ''}`} style={{ ['--tilt' as string]: `${((i * 7) % 5) - 2}deg` }} onClick={() => editEntry(e)}>
                <Cover entry={e} />
                {e.type !== 'photo' && (
                  <div className="badge">
                    <span className="tag">{ENTRY_LABEL[e.type].one}</span>
                    {typeof e.rating === 'number' && <span className="tag dot">{e.rating}</span>}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="stack" style={{ gap: 2 }}>
            {shown.map((e) => (
              <button key={e.id} className="list-item" onClick={() => editEntry(e)}>
                <div className="thumb"><Cover entry={e} /></div>
                <div className="txt">
                  <b>{e.title}</b>
                  <small>{[e.subtitle, e.year, e.note && `“${e.note}”`].filter(Boolean).join(' · ') || dotDate(e.date)}</small>
                </div>
                {typeof e.rating === 'number' && <Rating value={e.rating} />}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section stack" style={{ gap: 10 }}>
        <button className="btn plus light block" style={{ justifyContent: 'space-between' }} disabled={!reading && entries.length === 0} onClick={async () => { if (!period.reading) await generate(); share() }}>
          compartilhar recap <span className="plus-dot"><Icon name="share" size={18} /></span>
        </button>
        <button className="btn glassy block" disabled={generating} onClick={toggleClose}>
          <Icon name={closed ? 'refresh' : 'lock'} size={18} /> {closed ? 'reabrir período' : 'fechar recap e guardar como era'}
        </button>
        <p className="note" style={{ textAlign: 'center', margin: '4px 0 0' }}>recaps são privados. só saem do aparelho quando você compartilha.</p>
      </section>

      {editingReading && reading && (
        <ReadingEditor
          reading={reading}
          onClose={() => setEditingReading(false)}
          onSave={async (r) => {
            await savePeriod({ ...period, reading: r })
            setEditingReading(false)
            toast('leitura salva')
          }}
        />
      )}

      {confirmDelete && (
        <Sheet title="excluir período" onClose={() => setConfirmDelete(false)}>
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>a leitura e os cards deste período são apagados. e os registros?</p>
            <button className="btn glassy block" onClick={async () => { await deletePeriod(period.id, false); toast('período excluído'); back() }}>
              manter registros no diário
            </button>
            <button className="btn danger block" onClick={async () => { await deletePeriod(period.id, true); toast('período e registros apagados'); back() }}>
              apagar também os registros exclusivos dele
            </button>
            <p className="note" style={{ margin: 0 }}>registros que também pertencem a outro período são mantidos.</p>
          </div>
        </Sheet>
      )}
    </div>
  )
}
