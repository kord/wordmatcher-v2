import type { Language, ProgressRecord } from '../domain/types'
import { STORE_PROGRESS, readAll, readMany, removeMany, writeMany } from './db'

/**
 * Progress is per word id, independent of which list a word came from, so the same word
 * shares its history across lists.
 *
 * It is read one variety at a time, because that is what the learner is shown. The records
 * themselves would not collide if they were read together - Taiwanese entries have their own
 * ids - but the counts would be added up, which is the thing the separation is for.
 */
export async function loadProgress(language: Language): Promise<Map<string, ProgressRecord>> {
    const records = await readAll<ProgressRecord>(STORE_PROGRESS)
    return new Map(
        records
            .filter((record) => record.language === language)
            .map((record) => [record.wordId, record]),
    )
}

export async function loadProgressFor(wordIds: readonly string[]): Promise<ProgressRecord[]> {
    return readMany<ProgressRecord>(STORE_PROGRESS, wordIds)
}

export async function saveProgress(records: readonly ProgressRecord[]): Promise<void> {
    await writeMany(STORE_PROGRESS, records)
}

/** Erases one variety's progress and leaves the other's alone. */
export async function resetProgress(language: Language): Promise<void> {
    const records = await readAll<ProgressRecord>(STORE_PROGRESS)
    const keys = records
        .filter((record) => record.language === language)
        .map((record) => record.wordId)
    await removeMany(STORE_PROGRESS, keys)
}
