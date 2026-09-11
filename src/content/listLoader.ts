import type { ListManifest, WordListFile } from '../domain/types'

/**
 * Word lists are generated at build time and served as static JSON, so the
 * device only downloads the lists it actually plays. The service worker caches
 * them, making previously played lists available offline.
 */
const DATA_ROOT = `${import.meta.env.BASE_URL}data/lists/`

let manifestPromise: Promise<ListManifest> | null = null
let manifestCache: ListManifest | null = null

const listCache = new Map<string, Promise<WordListFile>>()

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${DATA_ROOT}${path}`)
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
}

export async function loadManifest(): Promise<ListManifest> {
    if (manifestCache) return manifestCache
    if (!manifestPromise) {
        manifestPromise = fetchJson<ListManifest>('manifest.json')
            .then((manifest) => {
                manifestCache = manifest
                return manifest
            })
            .catch((error: unknown) => {
                // Allow a retry after a transient failure (e.g. offline first load).
                manifestPromise = null
                throw error
            })
    }
    return manifestPromise
}

export function loadList(id: string): Promise<WordListFile> {
    const cached = listCache.get(id)
    if (cached) return cached

    const request = fetchJson<WordListFile>(`${id}.json`).catch((error: unknown) => {
        listCache.delete(id)
        throw error
    })
    listCache.set(id, request)
    return request
}

export async function loadLists(ids: readonly string[]): Promise<WordListFile[]> {
    return Promise.all(ids.map((id) => loadList(id)))
}

export function resetContentCache(): void {
    manifestPromise = null
    manifestCache = null
    listCache.clear()
}
