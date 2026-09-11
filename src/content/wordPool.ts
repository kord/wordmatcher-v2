import type { HskLevel, ListManifest, ListSelection, WordEntry } from '../domain/types'
import { loadList } from './listLoader'

export interface ResolvedPool {
    /** Words that may be asked. */
    entries: WordEntry[]
    listNames: string[]
    /**
     * Wider pool used only to source wrong answers. Defaults to `entries`.
     *
     * A mistake-review session may contain a single word, which cannot supply its
     * own distractors, so its distractors are drawn from the full studied list.
     */
    distractorPool?: WordEntry[]
}

/** Which list ids a selection needs, in a stable order. */
export function listIdsFor(selection: ListSelection): string[] {
    if (selection.kind === 'junda') return ['junda']

    const levels: HskLevel[] = selection.includeLower
        ? ([1, 2, 3, 4, 5, 6] as HskLevel[]).filter((level) => level <= selection.level)
        : [selection.level]

    return levels.map((level) => `hsk${level}`)
}

/**
 * Turn a selection into the pool of words a session draws from.
 *
 * Merged HSK levels are de-duplicated by word id: the same word can appear at
 * more than one level, and it must only be asked once per session.
 */
export async function resolvePool(
    selection: ListSelection,
    manifest: ListManifest,
): Promise<ResolvedPool> {
    const ids = listIdsFor(selection)
    const nameOf = new Map(manifest.lists.map((list) => [list.id, list.name]))

    const files = await Promise.all(ids.map((id) => loadList(id)))

    const byId = new Map<string, WordEntry>()
    for (const file of files) {
        for (const entry of file.entries) {
            if (byId.has(entry.id)) continue
            if (selection.kind === 'junda' && entry.rank !== undefined && entry.rank > selection.maxRank) {
                continue
            }
            byId.set(entry.id, entry)
        }
    }

    return {
        entries: [...byId.values()],
        listNames: ids.map((id) => nameOf.get(id) ?? id),
    }
}
