/**
 * Temas visuais. Todos partem da mesma linguagem (preto, azul, plano, lo-fi, caixa alta)
 * e variam tipografia, tom de azul e cantos. A escolha fica em ajustes.
 */
export type ThemeId = 'loop' | 'flash' | 'sticker'

export interface Theme {
  id: ThemeId
  name: string
  blurb: string
  fonts: { ui: string; display: string; num: string }
  display: { weight: number; upper: boolean; stretch: string; tracking: string; leading: number; scale: number }
  color: { accent: string; accentInk: string; accent2: string }
  radius: { sm: number; md: number; lg: number; xl: number; btn: number }
}

export const THEMES: Record<ThemeId, Theme> = {
  loop: {
    id: 'loop',
    name: 'LOOP',
    blurb: 'grotesca larga e pesada, mono nos números, azul elétrico',
    fonts: { ui: 'Archivo', display: 'Archivo', num: 'Space Mono' },
    display: { weight: 900, upper: true, stretch: '125%', tracking: '-0.01em', leading: 0.92, scale: 0.78 },
    color: { accent: '#2B5CFF', accentInk: '#FFFFFF', accent2: '#8FB0FF' },
    radius: { sm: 6, md: 10, lg: 14, xl: 18, btn: 10 },
  },
  flash: {
    id: 'flash',
    name: 'FLASH',
    blurb: 'condensada de cartaz, pixel nos números, azul neon',
    fonts: { ui: 'DM Sans', display: 'Anton', num: 'VT323' },
    display: { weight: 400, upper: true, stretch: '100%', tracking: '0.01em', leading: 0.95, scale: 1.05 },
    color: { accent: '#00B2FF', accentInk: '#000000', accent2: '#7FE0FF' },
    radius: { sm: 0, md: 2, lg: 4, xl: 6, btn: 2 },
  },
  sticker: {
    id: 'sticker',
    name: 'STICKER',
    blurb: 'arredondada e larga, bitmap nos números, azul cobalto',
    fonts: { ui: 'Figtree', display: 'Unbounded', num: 'Silkscreen' },
    display: { weight: 700, upper: false, stretch: '100%', tracking: '-0.03em', leading: 1, scale: 0.8 },
    color: { accent: '#3D6BFF', accentInk: '#FFFFFF', accent2: '#B7C8FF' },
    radius: { sm: 12, md: 18, lg: 24, xl: 28, btn: 999 },
  },
}

export const THEME_ORDER: ThemeId[] = ['flash', 'loop', 'sticker']
export const DEFAULT_THEME: ThemeId = 'flash'
/** v2: só guarda a escolha explícita feita em ajustes */
const KEY = 'moody.theme.v2'

export function loadThemeId(): ThemeId {
  try {
    const t = localStorage.getItem(KEY) as ThemeId | null
    if (t && t in THEMES) return t
  } catch {
    /* ignora */
  }
  return DEFAULT_THEME
}

let current: Theme = THEMES[DEFAULT_THEME]
export const currentTheme = () => current

export function applyTheme(id: ThemeId, persist = false) {
  const t = THEMES[id]
  current = t
  const r = document.documentElement
  r.dataset.theme = id
  const set = (k: string, v: string) => r.style.setProperty(k, v)
  set('--font-ui', `'${t.fonts.ui}', system-ui, sans-serif`)
  set('--font-display', `'${t.fonts.display}', '${t.fonts.ui}', sans-serif`)
  set('--font-num', `'${t.fonts.num}', ui-monospace, monospace`)
  set('--display-weight', String(t.display.weight))
  set('--display-transform', t.display.upper ? 'uppercase' : 'none')
  set('--display-stretch', t.display.stretch)
  set('--display-tracking', t.display.tracking)
  set('--display-leading', String(t.display.leading))
  set('--display-scale', String(t.display.scale))
  set('--accent', t.color.accent)
  set('--accent-ink', t.color.accentInk)
  set('--accent-2', t.color.accent2)
  set('--r-sm', `${t.radius.sm}px`)
  set('--r-md', `${t.radius.md}px`)
  set('--r-lg', `${t.radius.lg}px`)
  set('--r-xl', `${t.radius.xl}px`)
  set('--r-btn', `${t.radius.btn}px`)
  if (!persist) return
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignora */
  }
}
