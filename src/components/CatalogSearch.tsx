import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { searchCatalog, searchSource, type CatalogHit } from '../lib/catalog'
import type { EntryType } from '../lib/types'

interface Props {
  type: EntryType
  onPick: (hit: CatalogHit) => void
  /** quando presente, oferece usar o texto digitado sem resultado de catálogo */
  onManual?: (text: string) => void
  placeholder?: string
}

/** Campo de busca em catálogo com resultados em lista. */
export function CatalogSearch({ type, onPick, onManual, placeholder }: Props) {
  const source = searchSource(type)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<CatalogHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [doneFor, setDoneFor] = useState('')

  useEffect(() => {
    setHits([])
    setSearchErr('')
    if (!source || query.trim().length < 2) return
    const ac = new AbortController()
    const t = setTimeout(() => {
      setSearching(true)
      searchCatalog(type, query.trim(), ac.signal)
        .then((h) => {
          setHits(h)
          setDoneFor(query.trim())
        })
        .catch((e) => !ac.signal.aborted && setSearchErr(e instanceof Error ? e.message : 'busca indisponível'))
        .finally(() => !ac.signal.aborted && setSearching(false))
    }, 380)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [type, query, source])

  const pick = (h: CatalogHit) => {
    onPick(h)
    setHits([])
    setQuery('')
  }
  const manual = () => {
    onManual?.(query.trim())
    setHits([])
    setQuery('')
  }
  const q = query.trim()

  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="search">
        <Icon name="search" size={18} />
        <input
          className="input"
          placeholder={placeholder ?? (source ? `buscar no ${source}` : 'digite o título')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !source && q && onManual && manual()}
        />
      </label>
      {searching && <div className="pending" style={{ padding: '4px 8px' }}><i /><i /><i /></div>}
      {searchErr && <p className="note" style={{ margin: 0 }}>{searchErr}{onManual ? '' : ' — preencha à mão abaixo.'}</p>}
      {source && !searching && !searchErr && doneFor === q && q.length >= 2 && hits.length === 0 && (
        <p className="note" style={{ margin: 0 }}>nada encontrado{onManual ? '' : ' — preencha à mão abaixo.'}</p>
      )}
      {hits.map((h) => (
        <button key={h.key} className="hit" onClick={() => pick(h)}>
          <div className="thumb">{h.coverUrls[0] && <img src={h.coverUrls[0]} alt="" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}</div>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</b>
            <small className="faint">{[h.subtitle, h.year].filter(Boolean).join(' · ')}</small>
          </div>
        </button>
      ))}
      {onManual && q.length >= 1 && !searching && (!source || searchErr || doneFor === q || q.length < 2) && (
        <button className="hit" onClick={manual}>
          <div className="thumb" style={{ display: 'grid', placeItems: 'center' }}><Icon name="plus" size={18} /></div>
          <span>adicionar “{q}” {source ? 'sem busca' : ''}</span>
        </button>
      )}
    </div>
  )
}
