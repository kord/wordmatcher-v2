/**
 * Turn a Tâi-lô or POJ string from the ChhoeTaigi data into the app's `Romanization` shape,
 * so the display styles (diacritics, tone numbers, tone colours) work for Taiwanese exactly
 * as they do for pinyin.
 *
 * Both orthographies mark tone with a combining diacritic on the syllable:
 *
 *   tone 2     U+0301 acute        á
 *   tone 3     U+0300 grave        à
 *   tone 5     U+0302 circumflex   â
 *   tone 7     U+0304 macron       ā
 *   tone 8     U+030D vertical     a̍
 *   neutral    `--` written before the syllable (矣 `--ah`, 睏`--khì`)
 *
 * Tones 1 and 4 carry no diacritic at all and are told apart by the final consonant: an
 * unmarked syllable ending in h, k, p or t is a 4th tone, anything else is a 1st. That is
 * why this cannot be a pure "look at the accent" parse.
 *
 * POJ spells the vowel of `o͘` with U+0358 (combining dot above right) and the 8th tone with
 * U+030D, so the two never collide and stripping tone marks leaves the vowel intact. That was
 * checked against the data rather than assumed: had they shared a codepoint, no single parser
 * could have served both schemes.
 */
import type {
    Romanization,
    RomanizationScheme,
    RomanizationSyllable,
    Tone,
} from '../../src/domain/types.ts'

const TONE_BY_MARK: Readonly<Record<string, Tone>> = {
    '\u0301': 2,
    '\u0300': 3,
    '\u0302': 5,
    '\u0304': 7,
    '\u030d': 8,
}

const TONE_MARKS = /[\u0300\u0301\u0302\u0304\u030d]/g

/** An unmarked syllable ending in a stop is a checked syllable, i.e. the 4th tone. */
const CHECKED = /[hkpt]$/

/**
 * One syllable as written, including the combining marks that spell its tone.
 *
 * `\p{M}` covers those marks and also POJ's `o͘`; `\p{L}` covers `ⁿ`, which POJ uses as a
 * superscript nasal and which is a modifier letter rather than a mark.
 */
const SYLLABLE = /[\p{L}\p{M}]+/gu

function syllableOf(written: string, neutral: boolean): RomanizationSyllable {
    const decomposed = written.normalize('NFD')
    let tone: Tone = neutral ? 0 : 1

    if (!neutral) {
        for (const char of decomposed) {
            const marked = TONE_BY_MARK[char]
            if (marked !== undefined) {
                tone = marked
                break
            }
        }
        if (tone === 1 && CHECKED.test(decomposed)) tone = 4
    }

    return {
        // Base is the syllable without its tone, which for POJ keeps `o͘` because that is the
        // vowel rather than a tone mark.
        base: decomposed.replace(TONE_MARKS, '').normalize('NFC'),
        // A neutral syllable keeps its `--` so the diacritic style still shows it.
        marked: neutral ? `--${written}` : written,
        tone,
        han: /\p{L}/u.test(written),
    }
}

/**
 * Split a word into syllables.
 *
 * `-` separates syllables and `--` marks the following one as neutral, so the two are told
 * apart by the empty piece a doubled hyphen leaves behind: `khùn--khì` splits into
 * `['khùn', '', 'khì']`.
 */
function splitWord(word: string): { written: string; neutral: boolean }[] {
    const syllables: { written: string; neutral: boolean }[] = []
    let neutral = false

    for (const part of word.split('-')) {
        if (part.length === 0) {
            neutral = true
            continue
        }
        syllables.push({ written: part, neutral })
        neutral = false
    }

    return syllables
}

/**
 * The numbered form, built by rewriting each syllable where it stands so the hyphens and
 * spaces separating them survive. A neutral syllable is left as written, because its `--` is
 * already in the text and it has no tone number to gain.
 */
function numberedOf(text: string, syllables: readonly RomanizationSyllable[]): string {
    let index = 0

    return text.replace(SYLLABLE, (match) => {
        const syllable = syllables[index]
        index += 1
        if (!syllable) return match
        return syllable.tone === 0 ? syllable.base : `${syllable.base}${syllable.tone}`
    })
}

/**
 * Which contrastive tone number a syllable carries.
 *
 * The tones are exposed as numbers rather than as the accented text so the numbered display
 * style, and anything later that wants to colour by tone, has something to work with.
 */
export function parseReading(text: string, scheme: RomanizationScheme): Romanization {
    const trimmed = text.trim()
    const syllables: RomanizationSyllable[] = []

    for (const word of trimmed.split(/\s+/)) {
        if (word.length === 0) continue
        for (const { written, neutral } of splitWord(word)) {
            syllables.push(syllableOf(written, neutral))
        }
    }

    return {
        scheme,
        // The source string is already punctuated the way a reader expects, so it is kept
        // rather than rebuilt from the syllables.
        marked: trimmed,
        numbered: numberedOf(trimmed, syllables),
        syllables,
    }
}
