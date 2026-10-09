import type { EntryType } from './types'

export interface CatalogHit {
  key: string
  title: string
  subtitle?: string
  year?: string
  coverUrl?: string
  source: 'openlibrary' | 'musicbrainz'
}

/** Tipos com busca em catálogo aberto. Filmes e séries entram manualmente até a integração com TMDB. */
export const SEARCHABLE: Partial<Record<EntryType, string>> = {
  book: 'Open Library',
  album: 'MusicBrainz',
}

async function openLibrary(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Open Library indisponível')
  const json = (await res.json()) as {
    docs: { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }[]
  }
  return json.docs.map((d) => ({
    key: d.key,
    title: d.title,
    subtitle: d.author_name?.[0],
    year: d.first_publish_year ? String(d.first_publish_year) : undefined,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    source: 'openlibrary',
  }))
}

async function musicBrainz(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&type=album|ep&limit=8&fmt=json`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('MusicBrainz indisponível')
  const json = (await res.json()) as {
    'release-groups': { id: string; title: string; 'first-release-date'?: string; 'artist-credit'?: { name: string }[] }[]
  }
  return json['release-groups'].map((r) => ({
    key: r.id,
    title: r.title,
    subtitle: r['artist-credit']?.map((a) => a.name).join(', '),
    year: r['first-release-date']?.slice(0, 4) || undefined,
    coverUrl: `https://coverartarchive.org/release-group/${r.id}/front-250`,
    source: 'musicbrainz',
  }))
}

export function searchCatalog(type: EntryType, q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  if (type === 'book') return openLibrary(q, signal)
  if (type === 'album') return musicBrainz(q, signal)
  return Promise.resolve([])
}
