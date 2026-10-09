export type PeriodKind = '1m' | '3m' | '6m' | '1y' | 'week' | 'trip' | 'custom'

export type EntryType = 'album' | 'film' | 'series' | 'book' | 'place' | 'photo'

/** Um registro do diário. Pertence a uma data, não a um período: os períodos são janelas sobre o diário. */
export interface Entry {
  id: string
  type: EntryType
  title: string
  /** artista, autor, direção, cidade... */
  subtitle?: string
  year?: string
  /** blob local (capa baixada do catálogo ou foto enviada) */
  imageId?: string
  /** nota de 0 a 5, em passos de 0,5 */
  rating?: number
  note?: string
  /** data do registro, AAAA-MM-DD */
  date: string
  source?: 'manual' | 'openlibrary' | 'musicbrainz'
  createdAt: number
}

export interface Reading {
  /** nome da fase, em minúsculas */
  name: string
  words: string[]
  /** 5 cores hex */
  palette: string[]
  summary: string
  origin: 'ai' | 'local'
  edited: boolean
  generatedAt: number
}

export interface Period {
  id: string
  kind: PeriodKind
  title: string
  /** AAAA-MM-DD, inclusivo */
  start: string
  end: string
  status: 'open' | 'closed'
  reading?: Reading
  createdAt: number
  closedAt?: number
}

export const ENTRY_LABEL: Record<EntryType, { one: string; many: string }> = {
  album: { one: 'álbum', many: 'álbuns' },
  film: { one: 'filme', many: 'filmes' },
  series: { one: 'série', many: 'séries' },
  book: { one: 'livro', many: 'livros' },
  place: { one: 'lugar', many: 'lugares' },
  photo: { one: 'foto', many: 'fotos' },
}

export const ENTRY_ORDER: EntryType[] = ['album', 'film', 'series', 'book', 'place', 'photo']
