/**
 * Hand corrections to the reading that `pinyin-pro` derives.
 *
 * `pinyin-pro` reads a character in isolation and gives its most common reading, which is not
 * necessarily the reading of the sense the list glosses. 了 is the clearest case: the HSK 1
 * entry is the completion particle, glossed "(completed action marker)", but the standalone
 * character is read liǎo, the verb "to finish". Gloss and reading then describe different
 * words, and the learner is shown a pronunciation for a word they are not being taught.
 *
 * Keyed by `listId|simplified`, because the same character is a different word in different
 * lists: junda's 了 really is liǎo ("to finish") and hsk3's 过 really is guò ("to cross").
 * Only the entries glossed with the particle sense need correcting.
 *
 * The value is the numbered reading, written the way the pipeline writes it elsewhere: one
 * token per syllable, with `0` for the neutral tone.
 */
import { applyToneMark } from '../../src/domain/pinyin.ts'
import type { Romanization, RomanizationSyllable, Tone } from '../../src/domain/types.ts'

export const PINYIN_OVERRIDES: Readonly<Record<string, string>> = {
    // The completion particle, not the verb "to finish". Neutral, so `le`.
    'hsk1|了': 'le0',

    // The complement particle ("so that", "to the point of"), not dé "to obtain" and not
    // děi "must". Both HSK levels carry the particle gloss.
    'hsk2|得': 'de0',
    'hsk4|得': 'de0',

    // The experiential suffix ("have ever done"), which is neutral. The verb "to cross" is
    // guò and stays as derived, in hsk3 and in junda.
    'hsk2|过': 'guo0',

    // The adverbial suffix, as in 慢慢地 "slowly", not dì "earth".
    'hsk3|地': 'de0',
}

const TRAILING_TONE = /(\d)$/

function toneOf(token: string): Tone {
    const value = Number(TRAILING_TONE.exec(token)?.[1] ?? 0)
    return value >= 1 && value <= 4 ? (value as Tone) : 0
}

/** Build the stored shape from a numbered reading, the form an override is written in. */
function readingFromNumbered(numbered: string): Romanization {
    const tokens = numbered
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)

    const syllables: RomanizationSyllable[] = tokens.map((token) => {
        const tone = toneOf(token)
        const base = token.replace(TRAILING_TONE, '')
        return {
            base,
            marked: applyToneMark(base, tone),
            tone,
            han: /^[a-zü]+$/i.test(base),
        }
    })

    return {
        scheme: 'pinyin',
        marked: syllables.map((syllable) => syllable.marked).join(' '),
        // Kept exactly as written, because this doubles as the key the gloss overrides are
        // looked up with, and so has to read the way a hand-written key does.
        numbered: numbered.trim(),
        syllables,
    }
}

const applied = new Set<string>()

/** The corrected reading for an entry, if one exists, recording that it was reached. */
export function pinyinOverrideFor(listId: string, simp: string): Romanization | undefined {
    const key = `${listId}|${simp}`
    const numbered = PINYIN_OVERRIDES[key]
    if (numbered === undefined) return undefined
    applied.add(key)
    return readingFromNumbered(numbered)
}

/**
 * Overrides that matched nothing.
 *
 * A key whose spelling or list has drifted stops applying silently: the correction is gone
 * but the build still succeeds. The data build fails on a non-empty result.
 */
export function unusedPinyinOverrides(): string[] {
    return Object.keys(PINYIN_OVERRIDES).filter((key) => !applied.has(key))
}
