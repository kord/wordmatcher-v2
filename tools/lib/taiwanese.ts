/**
 * Taiwanese (Tâi-gí) reading lookup over the filtered extract in `data/source/taiwanese.json`.
 *
 * Two indexes, because the source answers two different questions and neither is a
 * superset of the other:
 *
 *   byCharacters - our word and the Taiwanese headword are written the same, so the
 *                  romanisation is a *reading* of the word we already have (好 -> hó).
 *   byMandarin   - only the Mandarin gloss matches, so the Taiwanese headword is a
 *                  different word for the same meaning (吃 -> 食 tsia̍h). Showing that
 *                  beside 吃 is the point: it is what a Taiwanese speaker would say.
 *
 * A character match is not automatically the right answer. 不 is written 不 in both, but
 * the colloquial Taiwanese word is 毋 (m̄) — the identical-character row is the literary
 * reading. Choosing between them needs a ranking, and where the ranking is wrong we need
 * a hand correction, exactly as with the glosses.
 */
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { taiwaneseOverrideFor } from './taiwaneseOverrides.ts'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE_PATH = join(here, '..', '..', 'data', 'source', 'taiwanese.json')

export interface TaiwaneseRow {
    /** Mandarin forms this entry glosses (`HoaBun`). */
    m: string[]
    /** Taiwanese written forms (`HanLoTaibunKip`). */
    h: string[]
    /** Tai-lo romanisation (`KipUnicode`); `/` separates variants. */
    tl: string
    /** POJ romanisation (`PojUnicode`). */
    poj: string
}

export interface TaiwaneseSource {
    source: {
        name: string
        collection: string
        url: string
        licence: string
    }
    rows: TaiwaneseRow[]
}

export interface TaiwaneseIndex {
    rows: TaiwaneseRow[]
    byMandarin: Map<string, TaiwaneseRow[]>
    byCharacters: Map<string, TaiwaneseRow[]>
}

export async function loadTaiwaneseSource(): Promise<TaiwaneseSource> {
    const text = await readFile(SOURCE_PATH, 'utf8')
    return JSON.parse(text) as TaiwaneseSource
}

function push(map: Map<string, TaiwaneseRow[]>, key: string, row: TaiwaneseRow): void {
    const existing = map.get(key)
    if (existing) {
        if (!existing.includes(row)) existing.push(row)
        return
    }
    map.set(key, [row])
}

export function indexTaiwanese(rows: readonly TaiwaneseRow[]): TaiwaneseIndex {
    const byMandarin = new Map<string, TaiwaneseRow[]>()
    const byCharacters = new Map<string, TaiwaneseRow[]>()

    for (const row of rows) {
        for (const form of row.m) push(byMandarin, form, row)
        for (const form of row.h) push(byCharacters, form, row)
    }

    return { rows: [...rows], byMandarin, byCharacters }
}

export interface Candidate {
    row: TaiwaneseRow
    /** How the row was found, which is the strongest signal we have. */
    via: 'characters' | 'mandarin'
    /** The Taiwanese written form that matched, when found via characters. */
    matchedForm?: string
}

/**
 * Every row that could describe this word, best guess first.
 *
 * Deliberately returns the whole set rather than one answer: the ranking is a heuristic
 * and the interesting failures are the ones where a plausible rival exists, so callers
 * (and the override list) need to see what was passed over.
 */
export function candidatesFor(index: TaiwaneseIndex, simp: string, trad: string): Candidate[] {
    const forms = simp === trad ? [simp] : [trad, simp]
    const seen = new Set<TaiwaneseRow>()
    const candidates: Candidate[] = []

    for (const form of forms) {
        for (const row of index.byCharacters.get(form) ?? []) {
            if (seen.has(row)) continue
            seen.add(row)
            candidates.push({ row, via: 'characters', matchedForm: form })
        }
    }

    for (const form of forms) {
        for (const row of index.byMandarin.get(form) ?? []) {
            if (seen.has(row)) continue
            seen.add(row)
            candidates.push({ row, via: 'mandarin' })
        }
    }

    return candidates
}

/**
 * How much the winner should be trusted.
 *
 * `high` and `medium` come from a character match, which is a reading of the word we
 * already have and is nearly always right. `low` means the characters differ, so the
 * winner was chosen from competing translations by length - and the source has no
 * frequency signal to break those ties with, so it needs a human. `none` means the
 * dictionary has nothing, which is a real gap for some words (三, 十). `override` means a
 * person decided, and is the only value that is not a guess.
 */
export type Confidence = 'high' | 'medium' | 'low' | 'none' | 'override'

export interface Ranked {
    best: Candidate | null
    /** Everything else that could have won, best first. */
    alternatives: Candidate[]
    confidence: Confidence
    /** Short explanation of the decision, for the review report. */
    reason: string
    /** True when a hand correction supplied the answer rather than the ranking. */
    overridden: boolean
}

/** Tâi-lô separates syllables with hyphens; `--` marks a neutral-tone syllable. */
export function syllables(romanisation: string): number {
    return romanisation
        .replace(/--/g, '-')
        .split('-')
        .filter((part) => part.length > 0).length
}

function score(candidate: Candidate, simp: string, trad: string): number {
    const row = candidate.row
    const han = row.h[0] ?? ''
    let value = 0

    // Same characters means it is the same word, which beats any amount of guessing.
    if (candidate.via === 'characters') value += 100

    // The Mandarin column applies to the whole meaning; an exact match is a much better
    // sign than the form merely appearing inside a longer gloss.
    if (row.m.includes(trad) || row.m.includes(simp)) value += 40

    // Prefer a word about the same size as ours. An idiom that happens to gloss to the
    // same Mandarin word is usually longer: 吃 -> 食 rather than 吃 -> 祭孤.
    const size = han.length > 0 ? han.length : syllables(row.tl)
    value -= Math.abs(size - trad.length) * 10

    // Between otherwise equal words, prefer the simpler one.
    value -= syllables(row.tl) * 2

    // A headword listing several pronunciations is less settled.
    if (row.tl.includes('/')) value -= 5

    return value
}

/**
 * Pick one Taiwanese form for a word, and say how much to trust it.
 *
 * Ties are common and the source order is alphabetical by romanisation, not by
 * frequency, so a tie is decided by alphabetical accident. That is acceptable only
 * because the tie is reported: see the overrides list for the cases it gets wrong.
 */
export function rankCandidates(
    index: TaiwaneseIndex,
    simp: string,
    trad: string,
    listId?: string,
): Ranked {
    const candidates = candidatesFor(index, simp, trad)
    const override = listId === undefined ? undefined : taiwaneseOverrideFor(listId, simp)

    if (override) {
        // A hand correction is the answer rather than a guess, so it simply wins. The
        // candidates are still returned, because the report is how the correction gets
        // reviewed and retired.
        return {
            best: {
                row: {
                    m: [],
                    h: override.han.length > 0 ? [override.han] : [],
                    tl: override.tailo,
                    poj: override.poj,
                },
                via: 'mandarin',
            },
            alternatives: candidates,
            confidence: 'override',
            reason: override.reason,
            overridden: true,
        }
    }

    if (candidates.length === 0) {
        return {
            best: null,
            alternatives: [],
            confidence: 'none',
            reason: 'no candidate in the source',
            overridden: false,
        }
    }

    const ranked = [...candidates].sort((a, b) => score(b, simp, trad) - score(a, simp, trad))
    const best = ranked[0]
    const exactGloss = best.row.m.includes(trad) || best.row.m.includes(simp)

    if (best.via === 'characters') {
        return {
            best,
            alternatives: ranked.slice(1),
            confidence: exactGloss ? 'high' : 'medium',
            reason: exactGloss
                ? 'same characters, and the Mandarin gloss matches exactly'
                : 'same characters, but the gloss describes a different sense',
            overridden: false,
        }
    }

    return {
        best,
        alternatives: ranked.slice(1),
        confidence: 'low',
        reason: 'different characters, chosen by length - needs review',
        overridden: false,
    }
}
