import type { Entry, Period } from './types'

const DB_NAME = 'moody'
const VERSION = 1
type StoreName = 'entries' | 'periods' | 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('periods')) db.createObjectStore('periods', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(store: StoreName, mode: IDBTransactionMode = 'readonly') {
  const db = await open()
  return db.transaction(store, mode).objectStore(store)
}

export const db = {
  async all<T>(store: 'entries' | 'periods'): Promise<T[]> {
    return wrap((await tx(store)).getAll()) as Promise<T[]>
  },
  async put(store: 'entries' | 'periods', value: Entry | Period) {
    await wrap((await tx(store, 'readwrite')).put(value))
  },
  async remove(store: StoreName, id: string) {
    await wrap((await tx(store, 'readwrite')).delete(id))
  },
  async putBlob(id: string, blob: Blob) {
    await wrap((await tx('blobs', 'readwrite')).put(blob, id))
  },
  async getBlob(id: string): Promise<Blob | undefined> {
    return wrap((await tx('blobs')).get(id)) as Promise<Blob | undefined>
  },
  async clearAll() {
    for (const s of ['entries', 'periods', 'blobs'] as StoreName[]) {
      await wrap((await tx(s, 'readwrite')).clear())
    }
  },
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '')
