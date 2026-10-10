import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db, uid } from './lib/db'
import { inRange } from './lib/periods'
import type { Entry, Period } from './lib/types'
import { loadProfile, persistProfile, type Profile } from './lib/profile'

interface Store {
  ready: boolean
  entries: Entry[]
  periods: Period[]
  addEntry: (e: Omit<Entry, 'id' | 'createdAt'>, image?: Blob | null) => Promise<Entry>
  /** image: undefined mantém a imagem atual, null remove, Blob substitui */
  updateEntry: (e: Entry, image?: Blob | null) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  savePeriod: (p: Period) => Promise<void>
  deletePeriod: (id: string, withEntries: boolean) => Promise<void>
  entriesOf: (p: Pick<Period, 'start' | 'end'>) => Entry[]
  wipe: () => Promise<void>
  profile: Profile | null
  /** salva o perfil e apaga do aparelho as capas de favoritos que saíram */
  saveProfile: (p: Profile) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

const byDateDesc = (a: Entry, b: Entry) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [profile, setProfile] = useState<Profile | null>(loadProfile)

  useEffect(() => {
    Promise.all([db.all<Entry>('entries'), db.all<Period>('periods')])
      .then(([e, p]) => {
        setEntries(e.sort(byDateDesc))
        setPeriods(p)
      })
      .finally(() => setReady(true))
  }, [])

  const addEntry = useCallback(async (e: Omit<Entry, 'id' | 'createdAt'>, image?: Blob | null) => {
    const entry: Entry = { ...e, id: uid(), createdAt: Date.now() }
    if (image) {
      const imageId = uid()
      await db.putBlob(imageId, image)
      entry.imageId = imageId
    }
    await db.put('entries', entry)
    setEntries((list) => [entry, ...list].sort(byDateDesc))
    return entry
  }, [])

  const updateEntry = useCallback(async (e: Entry, image?: Blob | null) => {
    let next = e
    if (image !== undefined) {
      if (e.imageId) {
        await db.remove('blobs', e.imageId)
        forgetImage(e.imageId)
      }
      next = { ...e, imageId: undefined }
      if (image) {
        const imageId = uid()
        await db.putBlob(imageId, image)
        next.imageId = imageId
      }
    }
    await db.put('entries', next)
    setEntries((list) => list.map((x) => (x.id === next.id ? next : x)).sort(byDateDesc))
  }, [])

  const removeEntries = useCallback(async (toRemove: Entry[]) => {
    for (const e of toRemove) {
      await db.remove('entries', e.id)
      if (e.imageId) {
        await db.remove('blobs', e.imageId)
        forgetImage(e.imageId)
      }
    }
    const ids = new Set(toRemove.map((e) => e.id))
    setEntries((list) => list.filter((x) => !ids.has(x.id)))
  }, [])

  const deleteEntry = useCallback(
    async (id: string) => {
      const e = entries.find((x) => x.id === id)
      if (e) await removeEntries([e])
    },
    [entries, removeEntries],
  )

  const savePeriod = useCallback(async (p: Period) => {
    await db.put('periods', p)
    setPeriods((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]))
  }, [])

  const deletePeriod = useCallback(
    async (id: string, withEntries: boolean) => {
      const p = periods.find((x) => x.id === id)
      if (!p) return
      await db.remove('periods', id)
      setPeriods((list) => list.filter((x) => x.id !== id))
      if (withEntries) {
        // apaga só os registros que não pertencem a nenhum outro período
        const others = periods.filter((x) => x.id !== id)
        await removeEntries(entries.filter((e) => inRange(e.date, p) && !others.some((o) => inRange(e.date, o))))
      }
    },
    [periods, entries, removeEntries],
  )

  const entriesOf = useCallback((p: Pick<Period, 'start' | 'end'>) => entries.filter((e) => inRange(e.date, p)), [entries])

  const wipe = useCallback(async () => {
    await db.clearAll()
    imageCache.forEach((url) => URL.revokeObjectURL(url))
    imageCache.clear()
    setEntries([])
    setPeriods([])
    persistProfile(null)
    setProfile(null)
  }, [])

  const saveProfile = useCallback(
    async (p: Profile) => {
      const keep = new Set(p.favorites.map((f) => f.imageId).filter(Boolean))
      for (const f of profile?.favorites ?? []) {
        if (f.imageId && !keep.has(f.imageId)) {
          await db.remove('blobs', f.imageId)
          forgetImage(f.imageId)
        }
      }
      persistProfile(p)
      setProfile(p)
    },
    [profile],
  )

  const value = useMemo(
    () => ({ ready, entries, periods, addEntry, updateEntry, deleteEntry, savePeriod, deletePeriod, entriesOf, wipe, profile, saveProfile }),
    [ready, entries, periods, addEntry, updateEntry, deleteEntry, savePeriod, deletePeriod, entriesOf, wipe, profile, saveProfile],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider ausente')
  return s
}

/* ── URLs de imagens locais ── */

const imageCache = new Map<string, string>()

function forgetImage(id: string) {
  const url = imageCache.get(id)
  if (url) URL.revokeObjectURL(url)
  imageCache.delete(id)
}

export function useImage(id?: string): string | undefined {
  const [url, setUrl] = useState(() => (id ? imageCache.get(id) : undefined))
  useEffect(() => {
    if (!id) return setUrl(undefined)
    const cached = imageCache.get(id)
    if (cached) return setUrl(cached)
    let alive = true
    db.getBlob(id).then((blob) => {
      if (!blob || !alive) return
      const u = URL.createObjectURL(blob)
      imageCache.set(id, u)
      setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [id])
  return url
}
