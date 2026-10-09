import type { EntryType } from './types'
import { loadSettings } from './settings'

export type CatalogSource = 'tmdb' | 'googlebooks' | 'openlibrary' | 'musicbrainz'

export interface CatalogHit {
  key: string
  title: string
  subtitle?: string
  year?: string
  /** capas candidatas, da melhor para a pior; a primeira que baixar é guardada */
  coverUrls: string[]
  source: CatalogSource
  /** dados para completar o item depois da escolha (ex.: direção no TMDB) */
  ref?: { kind: 'movie' | 'tv'; id: number }
}

export const SOURCE_LABEL: Record<CatalogSource, string> = {
  tmdb: 'TMDB',
  googlebooks: 'Google Books',
  openlibrary: 'Open Library',
  musicbrainz: 'MusicBrainz',
}

export class CatalogError extends Error {}

/** Nome da fonte de busca por tipo, ou null quando não há busca disponível. */
export function searchSource(type: EntryType): string | null {
  if (type === 'film' || type === 'series') return loadSettings().tmdbKey ? 'TMDB' : null
  if (type === 'book') return 'Google Books'
  if (type === 'album') return 'MusicBrainz'
  return null
}

/* ───────────── TMDB (filmes e séries) ───────────── */

const TMDB = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p'

function tmdbFetch(path: string, params: Record<string, string>, signal?: AbortSignal) {
  const key = loadSettings().tmdbKey.trim()
  const qs = new URLSearchParams({ language: 'pt-BR', ...params })
  // token v4 (JWT) vai no cabeçalho; chave v3 vai na query
  const isBearer = key.startsWith('eyJ')
  if (!isBearer) qs.set('api_key', key)
  return fetch(`${TMDB}${path}?${qs}`, {
    signal,
    headers: isBearer ? { Authorization: `Bearer ${key}`, Accept: 'application/json' } : { Accept: 'application/json' },
  }).then(async (res) => {
    if (res.status === 401) throw new CatalogError('chave do TMDB inválida')
    if (!res.ok) throw new CatalogError('TMDB indisponível')
    return res.json()
  })
}

interface TmdbItem {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
}

async function tmdb(kind: 'movie' | 'tv', q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const json = (await tmdbFetch(`/search/${kind}`, { query: q, include_adult: 'false' }, signal)) as { results: TmdbItem[] }
  return json.results.slice(0, 8).map((r) => {
    const title = r.title ?? r.name ?? ''
    const original = r.original_title ?? r.original_name
    return {
      key: `${kind}-${r.id}`,
      title,
      subtitle: original && original !== title ? original : undefined,
      year: (r.release_date ?? r.first_air_date)?.slice(0, 4) || undefined,
      coverUrls: r.poster_path ? [`${TMDB_IMG}/w500${r.poster_path}`, `${TMDB_IMG}/w342${r.poster_path}`] : [],
      source: 'tmdb' as const,
      ref: { kind, id: r.id },
    }
  })
}

/** Completa o item escolhido: direção (filme) ou criação/canal (série). */
export async function enrichHit(hit: CatalogHit): Promise<CatalogHit> {
  if (hit.source !== 'tmdb' || !hit.ref) return hit
  try {
    if (hit.ref.kind === 'movie') {
      const c = (await tmdbFetch(`/movie/${hit.ref.id}/credits`, {})) as { crew: { job: string; name: string }[] }
      const dir = c.crew.filter((p) => p.job === 'Director').map((p) => p.name)
      return { ...hit, subtitle: dir.slice(0, 2).join(', ') || hit.subtitle }
    }
    const t = (await tmdbFetch(`/tv/${hit.ref.id}`, {})) as { created_by?: { name: string }[]; networks?: { name: string }[] }
    const who = t.created_by?.map((p) => p.name).slice(0, 2).join(', ') || t.networks?.[0]?.name
    return { ...hit, subtitle: who || hit.subtitle }
  } catch {
    return hit
  }
}

/* ───────────── livros: Google Books, com Open Library de reserva ───────────── */

interface GVolume {
  id: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    publishedDate?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
  }
}

async function googleBooks(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const key = loadSettings().googleKey.trim()
  const qs = new URLSearchParams({ q, maxResults: '8', printType: 'books' })
  if (key) qs.set('key', key)
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${qs}`, { signal })
  if (res.status === 429) throw new CatalogError('cota do Google Books esgotada')
  if (!res.ok) throw new CatalogError('Google Books indisponível')
  const json = (await res.json()) as { items?: GVolume[] }
  return (json.items ?? []).map(({ id, volumeInfo: v }) => {
    const isbn = v.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ?? v.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier
    const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail
    const coverUrls: string[] = []
    if (thumb) {
      const https = thumb.replace(/^http:/, 'https:').replace('&edge=curl', '')
      coverUrls.push(https.replace(/zoom=\d/, 'zoom=2'), https)
    }
    if (isbn) coverUrls.push(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`)
    return {
      key: `gb-${id}`,
      title: v.title,
      subtitle: v.authors?.slice(0, 2).join(', '),
      year: v.publishedDate?.slice(0, 4),
      coverUrls,
      source: 'googlebooks' as const,
    }
  })
}

async function openLibrary(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new CatalogError('Open Library indisponível')
  const json = (await res.json()) as {
    docs: { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }[]
  }
  return json.docs.map((d) => ({
    key: d.key,
    title: d.title,
    subtitle: d.author_name?.[0],
    year: d.first_publish_year ? String(d.first_publish_year) : undefined,
    coverUrls: d.cover_i ? [`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`] : [],
    source: 'openlibrary' as const,
  }))
}

async function books(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  try {
    const hits = await googleBooks(q, signal)
    if (hits.length) return hits
  } catch (e) {
    if (signal.aborted) throw e
  }
  return openLibrary(q, signal)
}

/* ───────────── álbuns ───────────── */

async function musicBrainz(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&type=album|ep&limit=8&fmt=json`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new CatalogError('MusicBrainz indisponível')
  const json = (await res.json()) as {
    'release-groups': { id: string; title: string; 'first-release-date'?: string; 'artist-credit'?: { name: string }[] }[]
  }
  return json['release-groups'].map((r) => ({
    key: r.id,
    title: r.title,
    subtitle: r['artist-credit']?.map((a) => a.name).join(', '),
    year: r['first-release-date']?.slice(0, 4) || undefined,
    coverUrls: [`https://coverartarchive.org/release-group/${r.id}/front-500`],
    source: 'musicbrainz' as const,
  }))
}

export function searchCatalog(type: EntryType, q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  switch (type) {
    case 'film':
      return tmdb('movie', q, signal)
    case 'series':
      return tmdb('tv', q, signal)
    case 'book':
      return books(q, signal)
    case 'album':
      return musicBrainz(q, signal)
    default:
      return Promise.resolve([])
  }
}
