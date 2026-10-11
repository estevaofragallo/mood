import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { searchCatalog, searchSource } from '../lib/catalog'
import { loadSettings } from '../lib/settings'
import { ENTRY_LABEL } from '../lib/types'
import { dotDate, today } from '../lib/periods'
import {
  MOODS, PICK_TYPES, excluded, loadDaily, localDaily, markKnown, norm, pastPicks, saveDaily,
  type AstroContext, type Daily, type MoodId, type Pick, type PickType,
} from '../lib/daily'

/** Indicação do dia: humor opcional, tipo desejado, uma obra e duas alternativas. */
export function DailyCard({ onRegister }: { onRegister: (p: Pick) => void }) {
  const { entries, profile } = useStore()
  const toast = useToast()
  const [daily, setDaily] = useState<Daily | null>(() => loadDaily())
  const [mood, setMood] = useState<MoodId | undefined>(daily?.mood)
  const [want, setWant] = useState<PickType | 'any'>(daily?.want ?? 'any')
  const [busy, setBusy] = useState(false)
  // o motor astronômico só é baixado no modo astral
  const [astro, setAstro] = useState<AstroContext | null>(null)
  useEffect(() => {
    const birth = profile?.mode === 'astral' ? profile.birth : undefined
    if (!birth?.date) return setAstro(null)
    let alive = true
    import('../lib/astro')
      .then((m) => alive && setAstro(m.astroContext(birth)))
      .catch(() => alive && setAstro(null))
    return () => {
      alive = false
    }
  }, [profile])

  async function generate(extraSkip: string[] = []) {
    setBusy(true)
    const round = (daily?.round ?? -1) + 1
    const skip = excluded(entries, profile, extraSkip)
    const skipTitles = [...entries.map((e) => e.title), ...(profile?.favorites.map((f) => f.title) ?? []), ...pastPicks().map((p) => p.title), ...extraSkip]
    let next: Daily | null = null
    if (loadSettings().apiKey) {
      try {
        const { aiDaily } = await import('../lib/daily-ai')
        next = await aiDaily({ mood, want, skip, skipTitles, profile, entries, astro, round })
      } catch {
        toast('a IA não respondeu — usei a curadoria local')
      }
    }
    next ??= localDaily({ mood, want, skip, profile, round, astro })
    if (!next) {
      toast('acabaram as indicações locais para esse filtro — tente outro tipo')
      setBusy(false)
      return
    }
    setDaily(next)
    saveDaily(next)
    setBusy(false)
    // capa: busca no catálogo, sem bloquear a indicação
    attachCovers(next).then((withCovers) => {
      setDaily((cur) => (cur && cur.round === withCovers.round ? withCovers : cur))
      saveDaily(withCovers)
    })
  }

  const swap = (i: number) => {
    if (!daily) return
    const alts = [...daily.alternates]
    const [chosen] = alts.splice(i, 1, daily.pick)
    const next = { ...daily, pick: chosen, alternates: alts }
    setDaily(next)
    saveDaily(next)
  }

  const known = () => {
    if (!daily) return
    markKnown(daily.pick.title)
    if (daily.alternates.length) {
      const [first, ...rest] = daily.alternates
      const next = { ...daily, pick: first, alternates: rest }
      setDaily(next)
      saveDaily(next)
      toast('anotado — não volta mais')
    } else generate([daily.pick.title])
  }

  const isToday = daily?.date === today()

  return (
    <section className="glass daily">
      <div className="row between">
        <span className="eyebrow" style={{ color: 'var(--accent-2)' }}>hoje · indicação</span>
        <span className="dot faint" style={{ fontSize: 14 }}>{dotDate(today())}</span>
      </div>
      {astro && (
        <p className="daily-sky">
          ☾ {astro.line} <span className="faint">· sol natal em {astro.natal.sun}</span>
        </p>
      )}

      {!isToday || !daily ? (
        <>
          <p className="serif daily-q">como você está hoje?</p>
          <div className="chips" style={{ margin: '0 -20px', padding: '2px 20px', flexWrap: 'wrap' }}>
            {MOODS.map((m) => (
              <button key={m.id} className={`chip${mood === m.id ? ' on' : ''}`} onClick={() => setMood(mood === m.id ? undefined : m.id)}>{m.label}</button>
            ))}
          </div>
          <div className="segmented" style={{ marginTop: 14 }}>
            <button className={want === 'any' ? 'on' : ''} onClick={() => setWant('any')}>tudo</button>
            {PICK_TYPES.map((t) => (
              <button key={t} className={want === t ? 'on' : ''} onClick={() => setWant(t)}>{ENTRY_LABEL[t].one}</button>
            ))}
          </div>
          <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={() => generate()}>
            {busy ? <span className="pending"><i /><i /><i /></span> : <><Icon name="sparkle" size={18} /> ver indicação do dia</>}
          </button>
        </>
      ) : (
        <PickView daily={daily} busy={busy} onRegister={() => onRegister(daily.pick)} onAnother={() => generate([daily.pick.title, ...daily.alternates.map((a) => a.title)])} onKnown={known} onSwap={swap} />
      )}
    </section>
  )
}

function PickView({ daily, busy, onRegister, onAnother, onKnown, onSwap }: { daily: Daily; busy: boolean; onRegister: () => void; onAnother: () => void; onKnown: () => void; onSwap: (i: number) => void }) {
  const p = daily.pick
  return (
    <div className="stack" style={{ gap: 14, marginTop: 12 }} key={p.title}>
      <div className="daily-pick">
        <div className="daily-cover">
          {p.coverUrl ? <img src={p.coverUrl} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} /> : <span className="sparkle" style={{ fontSize: 28 }}>✦</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <span className="tag">{ENTRY_LABEL[p.type].one}{daily.mood ? ` · ${MOODS.find((m) => m.id === daily.mood)?.label}` : ''}</span>
          <p className="serif daily-title">{p.title}</p>
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>{[p.creator, p.year].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>{p.why}</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary sm" style={{ flex: 1 }} onClick={onRegister}><Icon name="plus" size={16} /> registrar</button>
        <button className="btn glassy sm" disabled={busy} onClick={onAnother}>{busy ? <span className="pending"><i /><i /><i /></span> : 'outra'}</button>
        <button className="btn ghost sm" onClick={onKnown}>já conheço</button>
      </div>
      {daily.alternates.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>ou ainda</div>
          {daily.alternates.map((a, i) => (
            <button key={a.title} className="list-item" style={{ padding: '8px 4px' }} onClick={() => onSwap(i)}>
              <div className="thumb" style={{ width: 40, height: 40 }}>{a.coverUrl ? <img src={a.coverUrl} alt="" /> : null}</div>
              <div className="txt">
                <b>{a.title}</b>
                <small>{ENTRY_LABEL[a.type].one} · {[a.creator, a.year].filter(Boolean).join(' · ')}</small>
              </div>
              <Icon name="chevron" size={16} className="faint" />
            </button>
          ))}
        </div>
      )}
      <p className="note" style={{ margin: 0 }}>{daily.origin === 'ai' ? 'curadoria por IA a partir dos seus favoritos, registros e humor' : 'curadoria local — conecte a IA em ajustes para indicações sob medida'}</p>
    </div>
  )
}

async function attachCovers(d: Daily): Promise<Daily> {
  const find = async (p: Pick): Promise<Pick> => {
    if (p.coverUrl || !searchSource(p.type)) return p
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 8000)
      const hits = await searchCatalog(p.type, [p.title, p.creator].filter(Boolean).join(' '), ac.signal)
      clearTimeout(t)
      const hit = hits.find((h) => norm(h.title) === norm(p.title)) ?? hits[0]
      return { ...p, coverUrl: hit?.coverUrls[0] }
    } catch {
      return p
    }
  }
  const [pick, ...alternates] = await Promise.all([d.pick, ...d.alternates].map(find))
  return { ...d, pick, alternates }
}
