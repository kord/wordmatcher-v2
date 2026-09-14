/**
 * Tiny persistence layer over IndexedDB.
 *
 * Falls back to an in-memory store when IndexedDB is unavailable (private
 * browsing modes, tests, locked-down webviews) so the app still runs - progress
 * just does not survive a reload.
 */
export const DB_NAME = 'wordmatcher'
export const DB_VERSION = 1

export const STORE_PROGRESS = 'progress'
export const STORE_SESSIONS = 'sessions'

/** Primary key for each store, needed by the in-memory fallback. */
const KEY_PATH: Record<string, string> = {
    [STORE_PROGRESS]: 'wordId',
    [STORE_SESSIONS]: 'id',
}

const memoryStores = new Map<string, Map<string, unknown>>()

function memoryStore(name: string): Map<string, unknown> {
    let store = memoryStores.get(name)
    if (!store) {
        store = new Map()
        memoryStores.set(name, store)
    }
    return store
}

let cachedDb: Promise<IDBDatabase> | null = null

export function isIndexedDbAvailable(): boolean {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null
    } catch {
        return false
    }
}

export function openDb(): Promise<IDBDatabase> {
    if (cachedDb) return cachedDb

    cachedDb = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = () => {
            const db = request.result

            if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
                db.createObjectStore(STORE_PROGRESS, { keyPath: 'wordId' })
            }
            if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' })
                store.createIndex('startedAt', 'startedAt')
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab.'))
    })

    return cachedDb
}

function keyOf(storeName: string, value: unknown): string {
    const keyPath = KEY_PATH[storeName]
    return String((value as Record<string, unknown>)[keyPath])
}

export async function readAll<T>(storeName: string): Promise<T[]> {
    if (!isIndexedDbAvailable()) {
        return [...memoryStore(storeName).values()] as T[]
    }

    const db = await openDb()
    return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error)
    })
}

/** Records are small and few; filtering a full read keeps this simple. */
export async function readMany<T>(storeName: string, keys: readonly string[]): Promise<T[]> {
    if (keys.length === 0) return []
    const wanted = new Set(keys)
    const all = await readAll<T & Record<string, unknown>>(storeName)
    return all.filter((value) => wanted.has(keyOf(storeName, value))) as T[]
}

export async function writeMany<T>(storeName: string, values: readonly T[]): Promise<void> {
    if (values.length === 0) return

    if (!isIndexedDbAvailable()) {
        const store = memoryStore(storeName)
        for (const value of values) store.set(keyOf(storeName, value), value)
        return
    }

    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        for (const value of values) store.put(value)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
    })
}

export async function removeOne(storeName: string, key: string): Promise<void> {
    if (!isIndexedDbAvailable()) {
        memoryStore(storeName).delete(key)
        return
    }

    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function removeMany(storeName: string, keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return

    if (!isIndexedDbAvailable()) {
        const store = memoryStore(storeName)
        for (const key of keys) store.delete(key)
        return
    }

    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        for (const key of keys) store.delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
    })
}

export async function clearStore(storeName: string): Promise<void> {
    if (!isIndexedDbAvailable()) {
        memoryStore(storeName).clear()
        return
    }

    const db = await openDb()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

/** Test helper: forget the cached connection and any in-memory data. */
export function resetDbForTests(): void {
    cachedDb = null
    memoryStores.clear()
}
