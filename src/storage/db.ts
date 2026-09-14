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

/**
 * Cleared for the rest of the session once the database proves not to work.
 *
 * Being *present* is not the same as being *usable*: a connection can be wedged by a stalled
 * upgrade or by a pending deletion from another tab, and then calls hang rather than fail.
 */
let indexedDbUsable = true

/** How long to wait for a connection before giving up on IndexedDB for this session. */
const OPEN_TIMEOUT_MS = 3000

export function isIndexedDbAvailable(): boolean {
    if (!indexedDbUsable) return false
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null
    } catch {
        return false
    }
}

export function openDb(): Promise<IDBDatabase> {
    if (cachedDb) return cachedDb

    cachedDb = new Promise((resolve, reject) => {
        let settled = false
        let timer: ReturnType<typeof setTimeout>

        const finish = (action: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            action()
        }

        /*
         * A wedged IndexedDB can sit for ever without firing a single event - not even
         * `onblocked`, which reports a version change and nothing else. Without this timeout the
         * app waits here and the start button reads "Preparing..." indefinitely, which is the one
         * thing a first-time user must never see. Timing out costs the session its persistence,
         * not its existence.
         */
        timer = setTimeout(() => {
            finish(() => {
                cachedDb = null
                indexedDbUsable = false
                reject(new Error('IndexedDB did not respond.'))
            })
        }, OPEN_TIMEOUT_MS)

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

        request.onsuccess = () =>
            finish(() => {
                if (indexedDbUsable) resolve(request.result)
                else request.result.close()
            })
        request.onerror = () => finish(() => reject(request.error))
        request.onblocked = () =>
            finish(() => reject(new Error('IndexedDB upgrade blocked by another tab.')))
    })

    return cachedDb
}

/**
 * The connection, or null when IndexedDB cannot be used at all.
 *
 * Never rejects. Every operation falls back to the in-memory store instead, so a device that
 * refuses IndexedDB loses persistence rather than the app.
 */
async function openOrNull(): Promise<IDBDatabase | null> {
    if (!isIndexedDbAvailable()) return null
    try {
        return await openDb()
    } catch {
        indexedDbUsable = false
        return null
    }
}

function keyOf(storeName: string, value: unknown): string {
    const keyPath = KEY_PATH[storeName]
    return String((value as Record<string, unknown>)[keyPath])
}

export async function readAll<T>(storeName: string): Promise<T[]> {
    const db = await openOrNull()
    if (!db) return [...memoryStore(storeName).values()] as T[]

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

    const db = await openOrNull()
    if (!db) {
        const store = memoryStore(storeName)
        for (const value of values) store.set(keyOf(storeName, value), value)
        return
    }
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
    const db = await openOrNull()
    if (!db) {
        memoryStore(storeName).delete(key)
        return
    }
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function removeMany(storeName: string, keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return

    const db = await openOrNull()
    if (!db) {
        const store = memoryStore(storeName)
        for (const key of keys) store.delete(key)
        return
    }
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
    const db = await openOrNull()
    if (!db) {
        memoryStore(storeName).clear()
        return
    }
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
    indexedDbUsable = true
    memoryStores.clear()
}
