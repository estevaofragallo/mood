import type { CatalogSource } from './catalog'

export type FavType = 'book' | 'album' | 'film'
export const FAV_ORDER: FavType[] = ['book', 'album', 'film']

export interface Favorite {
  id: string
  type: FavType
  title: string
  subtitle?: string
  year?: string
  /** capa guardada localmente */
  imageId?: string
  source: CatalogSource | 'manual'
}

export interface BirthData {
  /** AAAA-MM-DD */
  date: string
  /** HH:MM; sem hora, o mapa sai sem ascendente e casas */
  time?: string
  /** cidade de nascimento, em texto */
  place?: string
}

export type Mode = 'astral' | 'taste'

export interface Profile {
  version: 1
  onboardedAt: number
  favorites: Favorite[]
  mode: Mode
  birth?: BirthData
  /** ordem em que as opções de modo foram mostradas (para medir viés de posição) */
  modeOrder?: Mode[]
}

const KEY = 'moody.profile'

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

export function persistProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    /* armazenamento indisponível */
  }
}
