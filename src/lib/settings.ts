const KEY = 'moody.settings'

export interface Settings {
  apiKey: string
  model: string
}

export const DEFAULT_MODEL = 'claude-opus-5-5'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { apiKey: '', model: DEFAULT_MODEL, ...JSON.parse(raw) }
  } catch {
    /* armazenamento indisponível */
  }
  return { apiKey: '', model: DEFAULT_MODEL }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignora */
  }
}
