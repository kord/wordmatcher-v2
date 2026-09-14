import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the generated Taiwanese list.
 *
 * This data is not derived mechanically the way the Mandarin lists are: the equivalent of
 * each word was resolved from a dictionary and then corrected by hand, so the failure this
 * file exists to catch is a *quiet* one - a form that parses, renders, and is simply wrong.
 *
 * Two things are worth asserting beyond shape. That every entry carries the Mandarin word
 * it answers for, because that contrast is the lesson. And that the two romanisations are
 * genuinely two: a build that quietly copied one into the other would look perfect and
 * teach Tâi-lô to someone who asked for POJ.
 *
 * Reads the committed JSON rather than rebuilding, so it also fails when the data is stale.
 */
interface Romanization {
    scheme: string
    marked: string
    numbered: string
    syllables: { base: string; marked: string; tone: number; han: boolean }[]
}

interface TaiwaneseEntry {
    simp: string
    trad: string
    glosses: string[]
    glossShort: string
    romanizations: Record<string, Romanization | undefined>
    mandarin?: {
        simp: string
        trad: string
        glossShort: string
        pinyin: Romanization
        differs: 'word' | 'reading'
        note?: string
    }
}

/**
 * Every Taiwanese list is checked the same way, so a new level inherits the guarantees rather
 * than getting its own copy of them.
 */
const LIST_IDS = ['hsk1-tw', 'hsk2-tw', 'hsk3-tw'] as const

function entriesOf(listId: string): TaiwaneseEntry[] {
    const file = JSON.parse(
        readFileSync(join(process.cwd(), 'public', 'data', 'lists', `${listId}.json`), 'utf8'),
    ) as { entries: TaiwaneseEntry[] }
    return file.entries
}

/** Locates a failure, since the entry itself may have no characters to name it by. */
function label(entry: TaiwaneseEntry): string {
    const written = entry.trad.length > 0 ? entry.trad : '(no characters)'
    return `${written} ${entry.romanizations.tailo?.marked ?? '?'} -> ${entry.mandarin?.simp ?? '?'}`
}

describe.each(LIST_IDS)('%s is complete enough to play', (listId) => {
    const entries = entriesOf(listId)

    it('covers every word in the Mandarin list it mirrors', () => {
        const mandarin = JSON.parse(
            readFileSync(
                join(process.cwd(), 'public', 'data', 'lists', `${listId.replace('-tw', '')}.json`),
                'utf8',
            ),
        ) as { entries: unknown[] }

        // The resolver drops a word it cannot place, so a shortfall here means the join or
        // the curation regressed rather than that the source lacks the word.
        expect(entries.length).toBe(mandarin.entries.length)
    })

    it('gives every entry a Mandarin counterpart', () => {
        for (const entry of entries) {
            expect(entry.mandarin, label(entry)).toBeDefined()
            expect(entry.mandarin?.glossShort.length, label(entry)).toBeGreaterThan(0)
        }
    })

    it('gives every entry at least one gloss', () => {
        for (const entry of entries) {
            expect(entry.glosses.length, label(entry)).toBeGreaterThan(0)
        }
    })
})

describe.each(LIST_IDS)('%s: the two romanisations are genuinely different systems', (listId) => {
    const entries = entriesOf(listId)

    it('gives every entry a Tai-lo reading', () => {
        for (const entry of entries) {
            expect(entry.romanizations.tailo, label(entry)).toBeDefined()
        }
    })

    it('spells them differently wherever the two schemes disagree', () => {
        // Tai-lo writes ts/tsh, oo and ing where POJ writes ch/chh, o͘ and eng, and it writes a
        // nasalised vowel as nn where POJ writes ⁿ. A word containing one of those cannot read
        // the same in both, so it must be spelled differently.
        //
        // `nn` only counts after a vowel. As a syllable onset the two schemes agree on it - 卵
        // is nn̄g in both - so requiring a difference there would be wrong.
        //
        // A word with none of these legitimately reads the same in both schemes, which is why
        // this only checks the ones that cannot.
        const differsInBothSchemes = /ts|oo|ing|[aeiou]nn/

        // Tone marks are combining characters and sit between the vowel and the `nn`, so they
        // have to be set aside before the pattern can see it.
        const setAsideToneMarks = (text: string) =>
            text.normalize('NFD').replace(/[\u0300-\u036d]/g, '')

        for (const entry of entries) {
            const tailo = entry.romanizations.tailo
            const poj = entry.romanizations.poj
            if (!tailo || !poj) continue

            if (differsInBothSchemes.test(setAsideToneMarks(tailo.marked))) {
                expect(tailo.marked, label(entry)).not.toBe(poj.marked)
            }
        }
    })

    it('labels each reading with its own scheme', () => {
        for (const entry of entries) {
            expect(entry.romanizations.tailo?.scheme, label(entry)).toBe('tailo')
            if (entry.romanizations.poj) {
                expect(entry.romanizations.poj.scheme, label(entry)).toBe('poj')
            }
        }
    })
})

describe.each(LIST_IDS)('%s: the romanisations are well formed', (listId) => {
    const entries = entriesOf(listId)

    it('gives every syllable a base without tone marks', () => {
        for (const entry of entries) {
            for (const reading of Object.values(entry.romanizations)) {
                for (const syllable of reading?.syllables ?? []) {
                    expect(syllable.base.length, label(entry)).toBeGreaterThan(0)
                    // The tone marks are combining characters; none may survive into base.
                    expect(/[\u0300\u0301\u0302\u0304\u030d]/.test(syllable.base), label(entry)).toBe(
                        false,
                    )
                }
            }
        }
    })

    it('uses tone numbers Tâi-lô actually has, and never the sixth', () => {
        const allowed = new Set([0, 1, 2, 3, 4, 5, 7, 8])

        for (const entry of entries) {
            for (const reading of Object.values(entry.romanizations)) {
                for (const syllable of reading?.syllables ?? []) {
                    expect(allowed.has(syllable.tone), `${label(entry)} tone ${syllable.tone}`).toBe(
                        true,
                    )
                }
            }
        }
    })

    it('keeps the written form exactly as the reading was parsed from', () => {
        for (const entry of entries) {
            for (const reading of Object.values(entry.romanizations)) {
                expect(reading?.marked.length, label(entry)).toBeGreaterThan(0)
                expect(reading?.syllables.length, label(entry)).toBeGreaterThan(0)
            }
        }
    })
})

describe.each(LIST_IDS)('%s: the difference from Mandarin is recorded honestly', (listId) => {
    const entries = entriesOf(listId)

    it('marks a difference of characters as a word difference', () => {
        for (const entry of entries) {
            if (!entry.mandarin) continue
            const sameCharacters = entry.trad.length > 0 && entry.trad === entry.mandarin.trad

            expect(entry.mandarin.differs, label(entry)).toBe(sameCharacters ? 'reading' : 'word')
        }
    })

    it('has some of each, because a list with only one kind would mean the join collapsed', () => {
        const kinds = entries.map((entry) => entry.mandarin?.differs)
        expect(kinds).toContain('word')
        expect(kinds).toContain('reading')
    })
})

describe.each(LIST_IDS)('%s: the Mandarin contrast drill has enough to work with', (listId) => {
    const entries = entriesOf(listId)
    const contrast = entries.filter((entry) => entry.mandarin?.differs === 'word')

    it('never offers a prompt that is also the answer', () => {
        // The drill is asked only where the words differ, so the prompt can never be the answer.
        // A word written without characters answers with its reading, which differs from the
        // Mandarin characters as well.
        for (const entry of contrast) {
            const answer = entry.trad.length > 0 ? entry.trad : entry.romanizations.tailo?.marked
            expect(answer, label(entry)).not.toBe(entry.mandarin?.trad)
        }
    })

    it('covers a usable share of the list', () => {
        // A minority by nature: most HSK 1 Taiwanese words share their characters with Mandarin
        // and differ only in reading. This is a floor against the join collapsing, not a target,
        // and it should rise as later levels are built.
        expect(contrast.length).toBeGreaterThan(20)
    })

    it('gives every contrast word same-length peers to source wrong answers from', () => {
        // Options are drawn from words of the answer's own visible length, so a word with fewer
        // than three peers would be asked with fewer than four options.
        const byLength = new Map<number, number>()
        for (const entry of contrast) {
            if (entry.trad.length === 0) continue
            byLength.set(entry.trad.length, (byLength.get(entry.trad.length) ?? 0) + 1)
        }

        for (const entry of contrast) {
            if (entry.trad.length === 0) continue
            expect(byLength.get(entry.trad.length), label(entry)).toBeGreaterThanOrEqual(4)
        }
    })
})
