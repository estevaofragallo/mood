import { loadSettings } from './settings'

export interface CheckResult {
  id: 'claude' | 'tmdb' | 'google' | 'musicbrainz' | 'openlibrary'
  label: string
  status: 'ok' | 'fail' | 'skip'
  detail: string
  ms?: number
}

async function timed(fn: () => Promise<string>): Promise<{ detail: string; ms: number }> {
  const t = performance.now()
  const detail = await fn()
  return { detail, ms: Math.round(performance.now() - t) }
}

/** mensagem legível: erros de rede do navegador viram "sem conexão" */
const why = (e: unknown, fallback = 'sem conexão') =>
  e instanceof Error && e.name !== 'AbortError' && !(e instanceof TypeError) ? e.message : fallback

const withTimeout = (ms: number) => {
  const ac = new AbortController()
  setTimeout(() => ac.abort(), ms)
  return ac.signal
}

/** Verifica, a partir do aparelho, cada serviço externo usado pelo app. */
export async function runChecks(): Promise<CheckResult[]> {
  const s = loadSettings()
  const checks: Promise<CheckResult>[] = []

  checks.push(
    (async (): Promise<CheckResult> => {
      const base = { id: 'claude' as const, label: `Claude (${s.model})` }
      if (!s.apiKey) return { ...base, status: 'skip', detail: 'sem chave — leituras e indicações usam o motor local' }
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk')
        const client = new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true, maxRetries: 0, timeout: 60_000 })
        const r = await timed(async () => {
          const res = await client.messages.create({
            model: s.model,
            max_tokens: 256,
            output_config: { effort: 'low' },
            messages: [{ role: 'user', content: 'responda apenas: ok' }],
          })
          const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
          return `respondeu “${text.slice(0, 20)}”`
        })
        return { ...base, status: 'ok', ...r }
      } catch (e) {
        const err = e as { status?: number; message?: string }
        const why = err.status === 401 ? 'chave inválida' : err.status === 404 ? 'modelo indisponível para esta chave' : err.status === 429 ? 'limite de uso atingido' : err.status === 400 ? `requisição recusada: ${err.message?.slice(0, 80)}` : err.status ? `erro ${err.status}` : 'sem conexão com api.anthropic.com'
        return { ...base, status: 'fail', detail: why }
      }
    })(),
  )

  checks.push(
    (async (): Promise<CheckResult> => {
      const base = { id: 'tmdb' as const, label: 'TMDB (filmes e séries)' }
      const key = s.tmdbKey.trim()
      if (!key) return { ...base, status: 'skip', detail: 'sem chave — filmes e séries entram à mão' }
      try {
        const bearer = key.startsWith('eyJ')
        const url = `https://api.themoviedb.org/3/search/movie?query=aftersun&language=pt-BR${bearer ? '' : `&api_key=${encodeURIComponent(key)}`}`
        const r = await timed(async () => {
          const res = await fetch(url, { signal: withTimeout(15_000), headers: bearer ? { Authorization: `Bearer ${key}` } : {} })
          if (res.status === 401) throw new Error('chave inválida')
          if (!res.ok) throw new Error(`erro ${res.status}`)
          const j = (await res.json()) as { results: { title: string; poster_path?: string }[] }
          const first = j.results[0]
          if (!first) return 'respondeu, mas sem resultados'
          // a capa precisa baixar com CORS para entrar nos cards
          if (first.poster_path) {
            const img = await fetch(`https://image.tmdb.org/t/p/w342${first.poster_path}`, { signal: withTimeout(15_000) })
            if (!img.ok) return `achou “${first.title}”, mas a capa falhou (${img.status})`
          }
          return `achou “${first.title}” com capa`
        })
        return { ...base, status: 'ok', ...r }
      } catch (e) {
        return { ...base, status: 'fail', detail: why(e) }
      }
    })(),
  )

  checks.push(
    (async (): Promise<CheckResult> => {
      const base = { id: 'google' as const, label: `Google Books (livros)${s.googleKey ? '' : ' · cota anônima'}` }
      try {
        const qs = new URLSearchParams({ q: 'torto arado', maxResults: '1' })
        if (s.googleKey) qs.set('key', s.googleKey.trim())
        const r = await timed(async () => {
          const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${qs}`, { signal: withTimeout(15_000) })
          if (res.status === 429) throw new Error('cota esgotada — crie uma chave em ajustes')
          if (res.status === 400 || res.status === 403) throw new Error('chave recusada')
          if (!res.ok) throw new Error(`erro ${res.status}`)
          const j = (await res.json()) as { items?: { volumeInfo: { title: string } }[] }
          return j.items?.[0] ? `achou “${j.items[0].volumeInfo.title}”` : 'respondeu, mas sem resultados'
        })
        return { ...base, status: 'ok', ...r }
      } catch (e) {
        return { ...base, status: 'fail', detail: why(e, 'sem conexão — a Open Library assume como reserva') }
      }
    })(),
  )

  checks.push(
    (async (): Promise<CheckResult> => {
      const base = { id: 'musicbrainz' as const, label: 'MusicBrainz (álbuns)' }
      try {
        const r = await timed(async () => {
          const res = await fetch('https://musicbrainz.org/ws/2/release-group/?query=blonde%20frank%20ocean&type=album&limit=1&fmt=json', { signal: withTimeout(15_000), headers: { Accept: 'application/json' } })
          if (!res.ok) throw new Error(`erro ${res.status}`)
          const j = (await res.json()) as { 'release-groups': { id: string; title: string }[] }
          const rg = j['release-groups'][0]
          if (!rg) return 'respondeu, mas sem resultados'
          const img = await fetch(`https://coverartarchive.org/release-group/${rg.id}/front-250`, { signal: withTimeout(15_000) }).catch(() => null)
          return `achou “${rg.title}”${img?.ok ? ' com capa' : ', capa indisponível'}`
        })
        return { ...base, status: 'ok', ...r }
      } catch (e) {
        return { ...base, status: 'fail', detail: why(e) }
      }
    })(),
  )

  checks.push(
    (async (): Promise<CheckResult> => {
      const base = { id: 'openlibrary' as const, label: 'Open Library (reserva de livros)' }
      try {
        const r = await timed(async () => {
          const res = await fetch('https://openlibrary.org/search.json?q=a%20hora%20da%20estrela&limit=1&fields=title', { signal: withTimeout(15_000) })
          if (!res.ok) throw new Error(`erro ${res.status}`)
          const j = (await res.json()) as { docs: { title: string }[] }
          return j.docs[0] ? `achou “${j.docs[0].title}”` : 'respondeu, mas sem resultados'
        })
        return { ...base, status: 'ok', ...r }
      } catch (e) {
        return { ...base, status: 'fail', detail: why(e) }
      }
    })(),
  )

  return Promise.all(checks)
}
