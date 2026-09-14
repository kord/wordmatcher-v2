import type { HskLevel, Language, ListManifest, ListSelection, WordEntry } from '../domain/types'
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

/**
 * Which list ids a selection needs, in a stable order.
 *
 * The variety chooses the file: the Taiwanese lists mirror the HSK levels under `-tw` ids,
 * so the same selection means "the equivalent list in the other language". Jun Da has no
 * Taiwanese counterpart - it is a Mandarin character-frequency list - and the settings keep
 * it out of Taiwanese sessions rather than silently substituting something else.
 */
export function listIdsFor(selection: ListSelection, language: Language): string[] {
    if (selection.kind === 'junda') return ['junda']

    const suffix = language === 'taiwanese' ? '-tw' : ''
    const levels: HskLevel[] = selection.includeLower
        ? ([1, 2, 3, 4, 5, 6] as HskLevel[]).filter((level) => level <= selection.level)
        : [selection.level]

    return levels.map((level) => `hsk${level}${suffix}`)
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
    language: Language,
): Promise<ResolvedPool> {
    const ids = listIdsFor(selection, language)
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
