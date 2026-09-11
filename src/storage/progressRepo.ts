import type { ProgressRecord } from '../domain/types'
import { STORE_PROGRESS, clearStore, readAll, readMany, writeMany } from './db'

/**
 * Progress is per word id, independent of which list a word came from, so the
 * same word shares its history across lists.
 */
export async function loadProgress(): Promise<Map<string, ProgressRecord>> {
    const records = await readAll<ProgressRecord>(STORE_PROGRESS)
    return new Map(records.map((record) => [record.wordId, record]))
}

export async function loadProgressFor(wordIds: readonly string[]): Promise<ProgressRecord[]> {
    return readMany<ProgressRecord>(STORE_PROGRESS, wordIds)
}

export async function saveProgress(records: readonly ProgressRecord[]): Promise<void> {
    await writeMany(STORE_PROGRESS, records)
}

export async function resetProgress(): Promise<void> {
    await clearStore(STORE_PROGRESS)
}
