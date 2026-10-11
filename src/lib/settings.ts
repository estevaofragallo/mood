const KEY = 'moody.settings'

export interface Settings {
  apiKey: string
  model: string
  /** chave v3 ou token de leitura v4 do TMDB (filmes e séries) */
  tmdbKey: string
  /** chave opcional da Google Books API (sem ela, vale a cota anônima) */
  googleKey: string
}

const DEFAULTS = { apiKey: '', model: 'claude-opus-5-5', tmdbKey: '', googleKey: '' }

export const DEFAULT_MODEL = 'claude-opus-5-5'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* armazenamento indisponível */
  }
  return { ...DEFAULTS }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignora */
  }
}
