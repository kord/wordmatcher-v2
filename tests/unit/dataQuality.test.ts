import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the generated word lists against the upstream defects that were reaching the
 * screen: CC-CEDICT's internal `字[pin1 yin1]` notation, a duplicated term prefix, mixed
 * bracket widths, unbalanced parentheses, and glosses far too long to serve as a quiz
 * prompt. See `tools/lib/gloss.ts` and `tools/lib/glossOverrides.ts` for the fixes.
 *
 * This reads the committed JSON rather than rebuilding it, so it also fails when the
 * generated data is stale - run `npm run data:build` after touching the pipeline.
 */
const LIST_IDS = ['hsk1', 'hsk2', 'hsk3', 'hsk4', 'hsk5', 'hsk6', 'junda']

/** Beyond this a gloss stops working as the prompt of an en-zh question. */
const MAX_SHORT_GLOSS = 80

interface RawEntry {
    simp: string
    romanizations: Record<string, { marked: string; numbered: string } | undefined>
    glosses: string[]
    glossShort: string
}

interface Item {
    list: string
    entry: RawEntry
}

interface Sense extends Item {
    sense: string
}

const entries: Item[] = LIST_IDS.flatMap((list) => {
    // Resolved from the working directory: Vitest runs with the project root as cwd,
    // and `import.meta.url` does not survive its transform reliably enough to use here.
    const path = join(process.cwd(), 'public', 'data', 'lists', `${list}.json`)
    const file = JSON.parse(readFileSync(path, 'utf8')) as { entries: RawEntry[] }
    return file.entries.map((entry) => ({ list, entry }))
})

const senses: Sense[] = entries.flatMap((item) =>
    item.entry.glosses.map((sense) => ({ ...item, sense })),
)

function label({ list, entry }: Item): string {
    return `${list} ${entry.simp} (${entry.romanizations.pinyin?.numbered ?? '?'}): ${entry.glossShort}`
}

function labelSense({ list, entry, sense }: Sense): string {
    return `${list} ${entry.simp} (${entry.romanizations.pinyin?.numbered ?? '?'}): ${sense}`
}

describe('generated glosses', () => {
    it('is reading every list', () => {
        expect(entries.length).toBeGreaterThan(9000)
    })

    it('gives every entry at least one gloss', () => {
        const offenders = entries
            .filter(({ entry }) => entry.glosses.length === 0 || !entry.glossShort)
            .map(label)

        expect(offenders).toEqual([])
    })

    it('does not leak CC-CEDICT bracket notation', () => {
        const offenders = senses
            .filter(({ sense }) => /\[[^[\]]*\d[^[\]]*\]/.test(sense))
            .map(labelSense)

        expect(offenders).toEqual([])
    })

    it('keeps parentheses balanced', () => {
        const offenders = senses
            .filter(({ sense }) => {
                const opens = (sense.match(/\(/g) ?? []).length
                const closes = (sense.match(/\)/g) ?? []).length
                return opens !== closes
            })
            .map(labelSense)

        expect(offenders).toEqual([])
    })

    it('uses only half-width punctuation', () => {
        const offenders = senses.filter(({ sense }) => /[\uff08\uff09\uff0c\uff1b\uff1a]/.test(sense)).map(labelSense)
        expect(offenders).toEqual([])
    })

    it('has no duplicated CJK term prefix', () => {
        const offenders = senses
            .filter(({ sense }) => /([\u4e00-\u9fff]{2,4})\1(?=[\u4e00-\u9fff])/.test(sense))
            .map(labelSense)

        expect(offenders).toEqual([])
    })

    it('keeps the short gloss inside the prompt budget', () => {
        const offenders = entries
            .filter(({ entry }) => entry.glossShort.length > MAX_SHORT_GLOSS)
            .map(({ list, entry }) => `${list} ${entry.simp}: ${entry.glossShort.length} chars`)

        expect(offenders).toEqual([])
    })

    it('does not open with a cross-reference or pronunciation note', () => {
        // "used in transliterations" is deliberately allowed: for 耶 and 鑫 that is the
        // whole meaning, not a definition that got skipped. A cross-reference or a bare
        // pronunciation note, by contrast, is never a definition of anything.
        const note =
            /^(variant of|old variant|see also|as opposed to|also written|(also|commonly|Taiwan) pr\.|pr\. )/i
        const offenders = entries.filter(({ entry }) => note.test(entry.glossShort)).map(label)

        expect(offenders).toEqual([])
    })

    it('has no stray whitespace', () => {
        const offenders = senses
            .filter(({ sense }) => sense !== sense.trim() || /\s{2,}/.test(sense))
            .map(labelSense)

        expect(offenders).toEqual([])
    })
})

describe('readings match the sense each entry is glossed with', () => {
    /**
     * Characters whose most common reading in isolation is not the reading of the sense the
     * list teaches, corrected by hand in `tools/lib/pinyinOverrides.ts`.
     *
     * The verb senses are asserted alongside the corrected ones, because the whole point of
     * keying an override by list is that the same character is a different word elsewhere:
     * 了 really is liǎo in the Jun Da list, and 过 really is guò in HSK 3.
     */
    const CASES: { list: string; simp: string; numbered: string }[] = [
        { list: 'hsk1', simp: '了', numbered: 'le0' },
        { list: 'hsk2', simp: '得', numbered: 'de0' },
        { list: 'hsk4', simp: '得', numbered: 'de0' },
        { list: 'hsk2', simp: '过', numbered: 'guo0' },
        { list: 'hsk3', simp: '地', numbered: 'de0' },
        { list: 'hsk3', simp: '过', numbered: 'guo4' },
        { list: 'junda', simp: '了', numbered: 'liao3' },
    ]

    it.each(CASES)('reads $list $simp as $numbered', ({ list, simp, numbered }) => {
        const match = entries.find((item) => item.list === list && item.entry.simp === simp)

        expect(match, `${list} has no entry for ${simp}`).toBeDefined()
        expect(match?.entry.romanizations.pinyin?.numbered).toBe(numbered)
    })
})
