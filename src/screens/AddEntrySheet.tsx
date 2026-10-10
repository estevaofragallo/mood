import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Icon, type IconName } from '../components/Icon'
import { Rating } from '../components/Rating'
import { Cover } from '../components/Cover'
import { useToast } from '../components/Toast'
import { useImage, useStore } from '../store'
import { SOURCE_LABEL, enrichHit, searchSource, type CatalogHit } from '../lib/catalog'
import { CatalogSearch } from '../components/CatalogSearch'
import { fetchFirstCover, processPhoto } from '../lib/images'
import { today } from '../lib/periods'
import { ENTRY_LABEL, ENTRY_ORDER, type Entry, type EntryType } from '../lib/types'

const SUB_LABEL: Record<EntryType, string> = {
  album: 'artista',
  film: 'direção',
  series: 'criação ou canal',
  book: 'autoria',
  place: 'cidade',
  photo: '',
}
const TITLE_HINT: Record<EntryType, string> = {
  album: 'nome do álbum',
  film: 'nome do filme',
  series: 'nome da série',
  book: 'título do livro',
  place: 'estabelecimento, bairro, parque…',
  photo: '',
}

interface Props {
  onClose: () => void
  /** data sugerida (ex.: dentro do período aberto) */
  defaultDate?: string
  /** registro existente: abre em modo edição */
  editing?: Entry
}

export function AddEntrySheet({ onClose, defaultDate, editing }: Props) {
  const { addEntry, updateEntry, deleteEntry } = useStore()
  const toast = useToast()
  const [type, setType] = useState<EntryType>(editing?.type ?? 'album')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? '')
  const [year, setYear] = useState(editing?.year ?? '')
  const [rating, setRating] = useState<number | undefined>(editing?.rating)
  const [note, setNote] = useState(editing?.note ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? today())
  const [hit, setHit] = useState<CatalogHit | null>(null)
  const [files, setFiles] = useState<File[]>([])
  // capa enviada à mão: undefined = sem mudança, null = removida, File = nova
  const [coverFile, setCoverFile] = useState<File | null | undefined>(undefined)
  const coverRef = useRef<HTMLInputElement>(null)
  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : undefined), [coverFile])
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }, [coverPreview])
  const [busy, setBusy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const source = searchSource(type)

  const chooseHit = (h: CatalogHit) => {
    setHit(h)
    setTitle(h.title)
    setSubtitle(h.subtitle ?? '')
    setYear(h.year ?? '')
    // completa direção/criação (TMDB) sem sobrescrever o que a pessoa já digitou
    enrichHit(h).then((full) => {
      if (full.subtitle && full.subtitle !== h.subtitle) setSubtitle((cur) => (cur === (h.subtitle ?? '') ? full.subtitle! : cur))
    })
  }

  const switchType = (t: EntryType) => {
    setType(t)
    setHit(null)
  }

  async function save() {
    setBusy(true)
    try {
      if (editing) {
        const image = coverFile === undefined ? undefined : coverFile ? await processPhoto(coverFile, 800) : null
        await updateEntry({ ...editing, title: title.trim(), subtitle: subtitle.trim() || undefined, year: year.trim() || undefined, rating, note: note.trim() || undefined, date }, image)
        toast('registro atualizado')
      } else if (type === 'photo') {
        for (const f of files) {
          const blob = await processPhoto(f)
          await addEntry({ type: 'photo', title: 'foto', note: note.trim() || undefined, date, source: 'manual' }, blob)
        }
        toast(files.length === 1 ? 'foto guardada ✦' : `${files.length} fotos guardadas ✦`)
      } else {
        const cover = coverFile ? await processPhoto(coverFile, 800) : hit?.coverUrls.length ? await fetchFirstCover(hit.coverUrls) : null
        if (!coverFile && hit?.coverUrls.length && !cover) toast('não consegui baixar a capa — adicione pela edição')
        await addEntry(
          {
            type,
            title: title.trim(),
            subtitle: subtitle.trim() || undefined,
            year: year.trim() || undefined,
            rating,
            note: note.trim() || undefined,
            date,
            source: hit?.source ?? 'manual',
          },
          cover,
        )
        toast(`${ENTRY_LABEL[type].one} registrado ✦`)
      }
      onClose()
    } catch {
      toast('não foi possível salvar')
    } finally {
      setBusy(false)
    }
  }

  const canSave = type === 'photo' ? (editing ? true : files.length > 0) : title.trim().length > 0

  return (
    <Sheet title={editing ? `editar ${ENTRY_LABEL[type].one}` : 'registrar'} onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        {!editing && (
          <div className="chips">
            {ENTRY_ORDER.map((t) => (
              <button key={t} className={`chip${t === type ? ' on' : ''}`} onClick={() => switchType(t)}>
                <Icon name={t as IconName} size={16} /> {ENTRY_LABEL[t].one}
              </button>
            ))}
          </div>
        )}

        {type === 'photo' && !editing ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...(e.target.files ?? [])])} />
            <button className="photo-drop" onClick={() => fileRef.current?.click()}>
              <Icon name="photo" size={28} />
              <b>{files.length ? `${files.length} ${files.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}` : 'escolher fotos'}</b>
              <span className="note">a localização e os metadados são removidos antes de guardar. nada sai do seu aparelho.</span>
            </button>
          </>
        ) : type !== 'photo' ? (
          <>
            {source && !editing && !hit && <CatalogSearch key={type} type={type} onPick={chooseHit} />}
            {!source && (type === 'film' || type === 'series') && !editing && (
              <p className="note" style={{ margin: 0 }}>para buscar pôsteres, conecte o TMDB em ajustes. por ora, preencha à mão e envie a capa abaixo.</p>
            )}
            {hit && (
              <div className="hit on">
                <div className="thumb">{hit.coverUrls[0] && <img src={hit.coverUrls[0]} alt="" />}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{hit.title}</b>
                  <small className="faint" style={{ display: 'block' }}>{SOURCE_LABEL[hit.source]}</small>
                </div>
                <button className="icon-btn sm" onClick={() => setHit(null)} aria-label="desfazer seleção"><Icon name="close" size={16} /></button>
              </div>
            )}
            <label className="field">
              <span>título</span>
              <input className="input" placeholder={TITLE_HINT[type]} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <label className="field" style={{ flex: 2 }}>
                <span>{SUB_LABEL[type]}</span>
                <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
              </label>
              {type !== 'place' && (
                <label className="field" style={{ flex: 1 }}>
                  <span>ano</span>
                  <input className="input" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
                </label>
              )}
            </div>
          </>
        ) : null}

        {editing && type === 'photo' && (
          <div className="tile photo" style={{ width: 160, ['--tilt' as string]: '-2deg' }}>
            <Cover entry={editing} />
          </div>
        )}

        {type !== 'photo' && (
          <div className="field">
            <span>capa</span>
            <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setCoverFile(f); e.target.value = '' }} />
            <CoverPicker
              preview={coverFile ? coverPreview : undefined}
              existingId={coverFile === undefined ? editing?.imageId : undefined}
              hitUrl={coverFile === undefined && !editing ? hit?.coverUrls[0] : undefined}
              onPick={() => coverRef.current?.click()}
              onRemove={() => setCoverFile(null)}
            />
          </div>
        )}

        {type !== 'photo' && (
          <div className="field">
            <span>nota</span>
            <Rating value={rating} onChange={setRating} />
          </div>
        )}

        <label className="field">
          <span>{type === 'photo' ? 'legenda (opcional)' : 'uma frase (opcional)'}</span>
          <input className="input" placeholder={type === 'photo' ? 'aparece no rodapé da polaroid' : 'o que ficou disso'} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <label className="field">
          <span>quando</span>
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>

        <button className="btn primary block" disabled={!canSave || busy} onClick={save}>
          {busy ? <span className="pending"><i /><i /><i /></span> : editing ? 'salvar' : 'registrar'}
        </button>
        {editing && (
          <button
            className="btn danger block"
            onClick={async () => {
              await deleteEntry(editing.id)
              toast('registro apagado')
              onClose()
            }}
          >
            <Icon name="trash" size={18} /> apagar registro
          </button>
        )}
      </div>
    </Sheet>
  )
}

function CoverPicker({ preview, existingId, hitUrl, onPick, onRemove }: { preview?: string; existingId?: string; hitUrl?: string; onPick: () => void; onRemove: () => void }) {
  const existing = useImage(existingId)
  const src = preview ?? existing ?? hitUrl
  return (
    <div className="row" style={{ gap: 14 }}>
      <button type="button" className="cover-slot" onClick={onPick} aria-label={src ? 'trocar capa' : 'adicionar capa'}>
        {src ? <img src={src} alt="" /> : <Icon name="photo" size={22} />}
      </button>
      <div className="stack" style={{ gap: 6, alignItems: 'flex-start' }}>
        <button type="button" className="btn glassy sm" onClick={onPick}>{src ? 'trocar capa' : 'adicionar capa'}</button>
        {src && !hitUrl ? (
          <button type="button" className="btn ghost sm" style={{ paddingLeft: 4 }} onClick={onRemove}>remover</button>
        ) : (
          <span className="note">pôster, print ou foto da capa</span>
        )}
      </div>
    </div>
  )
}
