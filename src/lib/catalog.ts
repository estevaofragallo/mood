import type { EntryType } from './types'
import { loadSettings } from './settings'

export type CatalogSource = 'tmdb' | 'wikipedia' | 'tvmaze' | 'googlebooks' | 'openlibrary' | 'musicbrainz'

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
  wikipedia: 'Wikipedia',
  tvmaze: 'TVmaze',
  googlebooks: 'Google Books',
  openlibrary: 'Open Library',
  musicbrainz: 'MusicBrainz',
}

export class CatalogError extends Error {}

/** Nome da fonte de busca por tipo, ou null quando não há busca disponível. */
export function searchSource(type: EntryType): string | null {
  if (type === 'film') return loadSettings().tmdbKey ? 'TMDB' : 'Wikipedia'
  if (type === 'series') return loadSettings().tmdbKey ? 'TMDB' : 'TVmaze'
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

/* ───────────── sem chave: Wikipedia (filmes e séries) e TVmaze (séries) ───────────── */

interface WikiPage {
  pageid: number
  title: string
  index?: number
  description?: string
  thumbnail?: { source: string }
  langlinks?: { lang: string; title?: string; '*'?: string }[]
}

const WIKI_KIND: Record<'film' | 'series', RegExp> = {
  film: /\b(filme|longa-metragem|curta-metragem|documentário|animação)\b/i,
  series: /\b(série|telessérie|minissérie|seriado|programa de televisão|sitcom|anime)\b/i,
}

async function wikiApi(lang: 'pt' | 'en', params: Record<string, string>, signal: AbortSignal) {
  const qs = new URLSearchParams({ action: 'query', format: 'json', formatversion: '1', origin: '*', ...params })
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${qs}`, { signal })
  if (!res.ok) throw new CatalogError('Wikipedia indisponível')
  return (await res.json()) as { query?: { pages?: Record<string, WikiPage> } }
}

/**
 * Busca na Wikipédia em português (título e descrição curta) e completa o pôster pela versão
 * em inglês, que hospeda cartazes; a portuguesa não aceita imagens com direitos reservados.
 */
async function wikipedia(kind: 'film' | 'series', q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const json = await wikiApi('pt', {
    generator: 'search',
    gsrsearch: `${q} ${kind === 'film' ? 'filme' : 'série'}`,
    gsrlimit: '10',
    prop: 'description|pageimages|langlinks',
    piprop: 'thumbnail',
    pithumbsize: '500',
    lllang: 'en',
  }, signal)
  const pages = Object.values(json.query?.pages ?? {})
    .filter((p) => WIKI_KIND[kind].test(p.description ?? ''))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .slice(0, 8)

  // pôsteres na Wikipédia em inglês, numa única chamada
  const enTitles = pages.map((p) => p.langlinks?.[0]?.['*'] ?? p.langlinks?.[0]?.title).filter((t): t is string => !!t)
  const enThumbs = new Map<string, string>()
  if (enTitles.length) {
    try {
      const en = await wikiApi('en', { titles: enTitles.join('|'), prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '500', redirects: '1' }, signal)
      for (const p of Object.values(en.query?.pages ?? {})) if (p.thumbnail) enThumbs.set(p.title, p.thumbnail.source)
    } catch {
      /* sem pôster: segue com o que houver */
    }
  }

  return pages.map((p) => {
    const desc = p.description ?? ''
    const year = desc.match(/\b(18|19|20)\d{2}\b/)?.[0]
    const by = desc.match(/(?:dirigid[oa]|criad[oa]|realizad[oa]) por (.+)$/i)?.[1]
    const enTitle = p.langlinks?.[0]?.['*'] ?? p.langlinks?.[0]?.title
    const title = p.title.replace(/\s*\((filme|série|telessérie|minissérie)[^)]*\)\s*$/i, '')
    const coverUrls = [enTitle && enThumbs.get(enTitle), p.thumbnail?.source].filter((u): u is string => !!u)
    return { key: `wiki-${p.pageid}`, title, subtitle: by, year, coverUrls, source: 'wikipedia' as const }
  })
}

async function tvmaze(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { signal })
  if (!res.ok) throw new CatalogError('TVmaze indisponível')
  const json = (await res.json()) as { show: { id: number; name: string; premiered?: string | null; image?: { medium?: string; original?: string } | null; network?: { name: string } | null; webChannel?: { name: string } | null } }[]
  return json.slice(0, 8).map(({ show }) => ({
    key: `tvmaze-${show.id}`,
    title: show.name,
    subtitle: show.network?.name ?? show.webChannel?.name ?? undefined,
    year: show.premiered?.slice(0, 4),
    coverUrls: [show.image?.original, show.image?.medium].filter((u): u is string => !!u),
    source: 'tvmaze' as const,
  }))
}

/** séries sem chave: TVmaze primeiro (pôsteres melhores); se não achar, Wikipedia */
async function seriesFree(q: string, signal: AbortSignal): Promise<CatalogHit[]> {
  try {
    const hits = await tvmaze(q, signal)
    if (hits.length) return hits
  } catch (e) {
    if (signal.aborted) throw e
  }
  return wikipedia('series', q, signal)
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
      return loadSettings().tmdbKey ? tmdb('movie', q, signal) : wikipedia('film', q, signal)
    case 'series':
      return loadSettings().tmdbKey ? tmdb('tv', q, signal) : seriesFree(q, signal)
    case 'book':
      return books(q, signal)
    case 'album':
      return musicBrainz(q, signal)
    default:
      return Promise.resolve([])
  }
}
