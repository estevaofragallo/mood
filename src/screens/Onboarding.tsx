import { useMemo, useRef, useState } from 'react'
import { useImage, useStore } from '../store'
import { Icon } from '../components/Icon'
import { CatalogSearch } from '../components/CatalogSearch'
import { useToast } from '../components/Toast'
import { db, uid } from '../lib/db'
import { enrichHit, searchSource, type CatalogHit } from '../lib/catalog'
import { fetchFirstCover } from '../lib/images'
import { today } from '../lib/periods'
import { FAV_ORDER, type BirthData, type FavType, type Favorite, type Mode, type Profile } from '../lib/profile'

type Step = 'welcome' | FavType | 'mode' | 'done'
const STEPS: Step[] = ['welcome', ...FAV_ORDER, 'mode', 'done']

const COPY: Record<FavType, { title: string; hint: string; many: string }> = {
  book: { title: 'três livros que dizem quem você é', hint: 'não precisam ser os melhores — só os que ficaram em você.', many: 'livros' },
  album: { title: 'três álbuns que você ouve de cabo a rabo', hint: 'aqueles que você não pula faixa.', many: 'álbuns' },
  film: { title: 'três filmes que você reveria hoje', hint: 'conforto, obsessão ou trauma bom: vale tudo.', many: 'filmes' },
}

interface Props {
  /** perfil existente: abre em modo edição */
  initial?: Profile | null
  startAt?: Step
  onDone: () => void
  onCancel?: () => void
}

export function Onboarding({ initial, startAt, onDone, onCancel }: Props) {
  const { saveProfile } = useStore()
  const toast = useToast()
  const editing = !!initial
  const [step, setStep] = useState<Step>(startAt ?? (editing ? 'book' : 'welcome'))
  const [favs, setFavs] = useState<Favorite[]>(initial?.favorites ?? [])
  const [pending, setPending] = useState<Record<string, string>>({}) // id → url remota enquanto a capa baixa
  const [mode, setMode] = useState<Mode | null>(initial?.mode ?? null)
  const [birth, setBirth] = useState<BirthData>(initial?.birth ?? { date: '' })
  const [noTime, setNoTime] = useState(!!initial?.birth && !initial.birth.time)
  // ordem aleatória das opções de modo, para nenhuma ser favorecida pela posição
  const order = useMemo<Mode[]>(() => initial?.modeOrder ?? (Math.random() < 0.5 ? ['astral', 'taste'] : ['taste', 'astral']), [initial])
  // capas baixadas nesta sessão: apagadas se a pessoa desistir
  const created = useRef(new Set<string>())

  const idx = STEPS.indexOf(step)
  const go = (s: Step) => {
    setStep(s)
    window.scrollTo({ top: 0 })
  }
  const next = () => go(STEPS[idx + 1])
  const prev = () => (editing && step === 'book' ? cancel() : go(STEPS[idx - 1]))

  async function addFav(type: FavType, hit: CatalogHit | null, manualTitle?: string) {
    if (favs.filter((f) => f.type === type).length >= 3) {
      toast('já são três — remova um para trocar')
      return
    }
    const fav: Favorite = hit
      ? { id: uid(), type, title: hit.title, subtitle: hit.subtitle, year: hit.year, source: hit.source }
      : { id: uid(), type, title: manualTitle!, source: 'manual' }
    setFavs((l) => [...l, fav])
    if (!hit) return
    if (hit.coverUrls[0]) setPending((p) => ({ ...p, [fav.id]: hit.coverUrls[0] }))
    const [full, blob] = await Promise.all([enrichHit(hit), fetchFirstCover(hit.coverUrls)])
    let imageId: string | undefined
    if (blob) {
      imageId = uid()
      await db.putBlob(imageId, blob)
      created.current.add(imageId)
    }
    setFavs((l) => l.map((f) => (f.id === fav.id ? { ...f, subtitle: full.subtitle ?? f.subtitle, imageId } : f)))
    setPending(({ [fav.id]: _, ...rest }) => rest)
  }

  async function removeFav(id: string) {
    const f = favs.find((x) => x.id === id)
    setFavs((l) => l.filter((x) => x.id !== id))
    if (f?.imageId && created.current.has(f.imageId)) {
      created.current.delete(f.imageId)
      await db.remove('blobs', f.imageId)
    }
  }

  async function cancel() {
    for (const id of created.current) await db.remove('blobs', id)
    onCancel?.()
  }

  async function finish() {
    await saveProfile({
      version: 1,
      onboardedAt: initial?.onboardedAt ?? Date.now(),
      favorites: favs,
      mode: mode ?? 'taste',
      birth: mode === 'astral' ? { date: birth.date, time: noTime ? undefined : birth.time || undefined, place: birth.place?.trim() || undefined } : undefined,
      modeOrder: order,
    })
    created.current.clear()
    if (editing) {
      toast('perfil atualizado')
      onDone()
    } else go('done')
  }

  const birthOk = mode === 'taste' || (mode === 'astral' && !!birth.date && birth.date <= today())

  return (
    <div className="screen onb" key={step}>
      {step !== 'welcome' && step !== 'done' && (
        <header className="topbar">
          <button className="icon-btn" onClick={prev} aria-label="voltar"><Icon name="back" size={20} /></button>
          <span className="dot faint" style={{ fontSize: 14 }}>{String(idx).padStart(2, '0')} / {String(STEPS.length - 2).padStart(2, '0')}</span>
          {editing ? <button className="icon-btn" onClick={cancel} aria-label="cancelar"><Icon name="close" size={18} /></button> : <span style={{ width: 44 }} />}
        </header>
      )}

      {step === 'welcome' && (
        <div className="onb-welcome">
          <div className="logo" style={{ fontSize: 76 }}>moody<sup>✦</sup></div>
          <p className="serif" style={{ fontSize: 34, lineHeight: 1.08, margin: '28px 0 14px' }}>
            quem você foi, <span className="muted">fase a fase.</span>
          </p>
          <p className="muted" style={{ margin: '0 0 36px', maxWidth: 320 }}>
            antes de tudo, conta pra gente o que te forma: três livros, três álbuns e três filmes. leva dois minutos.
          </p>
          <button className="btn plus light" onClick={next}>
            começar <span className="plus-dot"><Icon name="chevron" size={18} /></span>
          </button>
          <p className="note" style={{ marginTop: 22 }}>tudo fica no seu aparelho.</p>
        </div>
      )}

      {(step === 'book' || step === 'album' || step === 'film') && (
        <FavStep
          type={step}
          favs={favs.filter((f) => f.type === step)}
          pending={pending}
          onAdd={(hit, manual) => addFav(step, hit, manual)}
          onRemove={removeFav}
          onNext={next}
        />
      )}

      {step === 'mode' && (
        <div className="stack" style={{ gap: 20 }}>
          <div>
            <h1 className="onb-title">como o moody deve te ler?</h1>
            <p className="muted" style={{ margin: 0 }}>dá para mudar depois em ajustes, nos dois sentidos.</p>
          </div>
          <div className="mode-grid">
            {order.map((m) => (
              <button key={m} className={`glass kind interactive mode-card${mode === m ? ' on' : ''}`} onClick={() => setMode(m)} aria-pressed={mode === m}>
                <span className="mode-glyph">{m === 'astral' ? '☾ ✦' : '◐ ✧'}</span>
                <span>
                  <b style={{ display: 'block', fontSize: 16 }}>{m === 'astral' ? 'com astrologia' : 'pelo meu gosto e humor'}</b>
                  <small className="faint">
                    {m === 'astral' ? 'seu mapa e os trânsitos do dia entram nas leituras e indicações.' : 'leituras e indicações a partir do que você registra e de como você está.'}
                  </small>
                </span>
              </button>
            ))}
          </div>

          {mode === 'astral' && (
            <div className="glass card stack" style={{ gap: 14 }}>
              <label className="field">
                <span>data de nascimento</span>
                <input className="input" type="date" max={today()} value={birth.date} onChange={(e) => setBirth((b) => ({ ...b, date: e.target.value }))} />
              </label>
              <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>hora (opcional)</span>
                  <input className="input" type="time" disabled={noTime} value={noTime ? '' : birth.time ?? ''} onChange={(e) => setBirth((b) => ({ ...b, time: e.target.value }))} />
                </label>
                <button type="button" className={`chip${noTime ? ' on' : ''}`} style={{ height: 50, marginBottom: 0 }} onClick={() => setNoTime((v) => !v)}>
                  não sei a hora
                </button>
              </div>
              <label className="field">
                <span>cidade de nascimento</span>
                <input className="input" placeholder="ex.: curitiba, pr" value={birth.place ?? ''} onChange={(e) => setBirth((b) => ({ ...b, place: e.target.value }))} />
              </label>
              <p className="note" style={{ margin: 0 }}>
                {noTime ? 'sem a hora, o mapa sai sem ascendente e casas — sol, lua e planetas continuam valendo. ' : 'com a hora e a cidade, dá para calcular ascendente e casas. '}
                esses dados ficam só no aparelho e podem ser apagados em ajustes.
              </p>
            </div>
          )}

          <button className="btn primary block" disabled={!mode || !birthOk} onClick={finish}>
            {editing ? 'salvar perfil' : 'continuar'}
          </button>
        </div>
      )}

      {step === 'done' && <Done favs={favs} mode={mode ?? 'taste'} onEnter={onDone} />}
    </div>
  )
}

function FavStep({ type, favs, pending, onAdd, onRemove, onNext }: {
  type: FavType
  favs: Favorite[]
  pending: Record<string, string>
  onAdd: (hit: CatalogHit | null, manual?: string) => void
  onRemove: (id: string) => void
  onNext: () => void
}) {
  const c = COPY[type]
  const noSearch = !searchSource(type)
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 className="onb-title">{c.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{c.hint}</p>
      </div>
      <div className="slots">
        {[0, 1, 2].map((i) => {
          const f = favs[i]
          return f ? (
            <FavSlot key={f.id} fav={f} remoteUrl={pending[f.id]} onRemove={() => onRemove(f.id)} />
          ) : (
            <div key={`empty-${i}`} className="slot empty"><span className="dot">{String(i + 1).padStart(2, '0')}</span></div>
          )
        })}
      </div>
      {favs.length < 3 ? (
        <>
          <CatalogSearch key={type} type={type} onPick={(h) => onAdd(h)} onManual={(t) => onAdd(null, t)} />
          {noSearch && type === 'film' && <p className="note" style={{ margin: 0 }}>sem a chave do TMDB, os filmes entram só pelo título. as capas podem ser buscadas depois de conectar em ajustes.</p>}
        </>
      ) : (
        <p className="note" style={{ margin: 0, textAlign: 'center' }}>✦ três de três. toque no × para trocar algum.</p>
      )}
      <button className={`btn ${favs.length ? 'primary' : 'ghost'} block`} onClick={onNext}>
        {favs.length ? 'continuar' : 'pular esta etapa'}
      </button>
    </div>
  )
}

function FavSlot({ fav, remoteUrl, onRemove }: { fav: Favorite; remoteUrl?: string; onRemove: () => void }) {
  const local = useImage(fav.imageId)
  const src = local ?? remoteUrl
  return (
    <div className="slot">
      {src ? <img src={src} alt="" /> : <div className="slot-ph"><span className="sparkle">✦</span></div>}
      {remoteUrl && !local && <span className="slot-loading"><span className="pending"><i /><i /><i /></span></span>}
      <button className="slot-x" onClick={onRemove} aria-label={`remover ${fav.title}`}><Icon name="close" size={14} /></button>
      <div className="slot-cap">
        <b>{fav.title}</b>
        {fav.subtitle && <small>{fav.subtitle}</small>}
      </div>
    </div>
  )
}

function Done({ favs, mode, onEnter }: { favs: Favorite[]; mode: Mode; onEnter: () => void }) {
  return (
    <div className="stack done-hide" style={{ gap: 22 }}>
      <div>
        <div className="sparkle" style={{ fontSize: 22 }}>✦ ✧</div>
        <h1 className="onb-title" style={{ marginTop: 10 }}>seu ponto de partida</h1>
        <p className="muted" style={{ margin: 0 }}>
          {favs.length ? 'daqui em diante, cada registro afina suas leituras e indicações.' : 'sem favoritos por enquanto — dá para adicionar depois em ajustes.'}
        </p>
      </div>
      {FAV_ORDER.map((t) => {
        const list = favs.filter((f) => f.type === t)
        if (!list.length) return null
        return (
          <div key={t}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>{COPY[t].many}</div>
            <div className="slots">
              {list.map((f) => <FavSlot key={f.id} fav={f} onRemove={() => {}} />)}
            </div>
          </div>
        )
      })}
      <span className="tag" style={{ alignSelf: 'flex-start' }}>
        <span className="sparkle">✦</span> {mode === 'astral' ? 'modo astral ligado' : 'modo gosto e humor'}
      </span>
      <button className="btn plus light block" style={{ justifyContent: 'space-between' }} onClick={onEnter}>
        entrar no moody <span className="plus-dot"><Icon name="chevron" size={18} /></span>
      </button>
    </div>
  )
}
