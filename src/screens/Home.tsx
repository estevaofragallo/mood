import { useStore } from '../store'
import { Cover } from '../components/Cover'
import { PeriodCard } from '../components/PeriodCard'
import { Icon } from '../components/Icon'
import { FIXED_KINDS, MONTHS, dotDate, phaseOf, today } from '../lib/periods'
import { ENTRY_LABEL, type Entry, type PeriodKind } from '../lib/types'

interface Props {
  openPeriod: (id: string) => void
  newPeriod: (kind?: PeriodKind) => void
  editEntry: (e: Entry) => void
}

export function Home({ openPeriod, newPeriod, editEntry }: Props) {
  const { periods, entries, entriesOf } = useStore()
  const now = new Date()
  const open = periods
    .filter((p) => p.status === 'open')
    .sort((a, b) => (a.end === b.end ? a.start.localeCompare(b.start) : a.end.localeCompare(b.end)))
  const toClose = open.filter((p) => phaseOf(p) === 'ended')
  const recent = entries.slice(0, 9)

  return (
    <div className="screen">
      <header className="topbar">
        <div className="logo">
          moody<sup>✦</sup>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="dot" style={{ fontSize: 15 }}>{dotDate(today())}</div>
          <div className="faint" style={{ fontSize: 12 }}>{MONTHS[now.getMonth()]}</div>
        </div>
      </header>

      <p className="serif" style={{ fontSize: 'calc(34px * var(--display-scale))', margin: '0 0 22px', maxWidth: 340 }}>
        quem você está sendo <span className="muted">agora</span>
      </p>

      {toClose.map((p) => (
        <button key={p.id} className="glass card tight row between interactive" style={{ width: '100%', marginBottom: 12, borderColor: 'var(--accent)' }} onClick={() => openPeriod(p.id)}>
          <span style={{ textAlign: 'left' }}>
            <b style={{ color: 'var(--accent-2)' }}>✦ {p.title} terminou</b>
            <small className="muted" style={{ display: 'block' }}>feche o recap e guarde essa era</small>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      ))}

      {open.length === 0 ? (
        <div className="glass empty">
          <div className="sparkle" style={{ fontSize: 26 }}>✦ ✧</div>
          <p className="big">nenhum período aberto</p>
          <p className="muted" style={{ margin: '0 0 20px' }}>escolha um recorte. tudo que você registrar dentro dele vira um recap.</p>
          <div className="row wrap" style={{ justifyContent: 'center', marginBottom: 18 }}>
            {FIXED_KINDS.map((k) => (
              <button key={k.kind} className="chip" onClick={() => newPeriod(k.kind)}>
                {k.label}
              </button>
            ))}
            <button className="chip" onClick={() => newPeriod('trip')}>viagem</button>
            <button className="chip" onClick={() => newPeriod('week')}>semanal</button>
          </div>
          <button className="btn plus light" onClick={() => newPeriod()}>
            abrir período <span className="plus-dot"><Icon name="plus" size={18} /></span>
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {open.map((p) => (
            <PeriodCard key={p.id} period={p} count={entriesOf(p).length} onOpen={() => openPeriod(p.id)} />
          ))}
          <button className="btn plus" style={{ alignSelf: 'center', marginTop: 6 }} onClick={() => newPeriod()}>
            outro período <span className="plus-dot"><Icon name="plus" size={18} /></span>
          </button>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>diário</h2>
          <span className="faint" style={{ fontSize: 13 }}>{entries.length} registros</span>
        </div>
        {recent.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>
            toque no <span className="sparkle">✦</span> abaixo para registrar um álbum, filme, série, livro, lugar ou foto. leva segundos.
          </p>
        ) : (
          <div className="grid">
            {recent.map((e, i) => (
              <button key={e.id} className={`tile${e.type === 'photo' ? ' photo' : ''}`} style={{ ['--tilt' as string]: `${(i % 3) - 1}deg` }} onClick={() => editEntry(e)} aria-label={`${ENTRY_LABEL[e.type].one}: ${e.title}`}>
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
        )}
      </section>
    </div>
  )
}
