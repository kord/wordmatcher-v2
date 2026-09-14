import type { Romanization, RomanizationScheme, RomanizationSyllable, PinyinStyle, Tone } from './types'

/**
 * Readings are stored per syllable at build time, so every display style is a pure
 * transformation here - no conversion library and no runtime cost.
 *
 * The Mandarin tone-marking rules below are specific to pinyin. Tai-lo marks tone with the
 * same family of diacritics but places them by different rules, so it is spelled out at
 * build time and only the display styles are applied here.
 */
const SUPERSCRIPT: Record<number, string> = { 0: '⁵', 1: '¹', 2: '²', 3: '³', 4: '⁴' }

/** Toneless vowel followed by its four toned forms. Index is the tone. */
const TONE_MARKS: Record<string, readonly string[]> = {
    a: ['a', 'ā', 'á', 'ǎ', 'à'],
    o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
    e: ['e', 'ē', 'é', 'ě', 'è'],
    i: ['i', 'ī', 'í', 'ǐ', 'ì'],
    u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
    'ü': ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

const VOWELS = new Set(['a', 'o', 'e', 'i', 'u', 'ü'])

/** Some sources write `ü` as `v`; treat them as the same vowel. */
function normaliseVowel(letter: string): string {
    return letter === 'v' ? 'ü' : letter
}

/**
 * Which vowel carries the tone mark: `a` beats `o`, which beats `e`; otherwise
 * the last vowel takes it, which is what makes `niu` → `niú` and `gui` → `guì`.
 */
function toneVowelIndex(letters: readonly string[]): number {
    for (const preferred of ['a', 'o', 'e']) {
        const index = letters.findIndex((letter) => normaliseVowel(letter) === preferred)
        if (index >= 0) return index
    }

    for (let index = letters.length - 1; index >= 0; index--) {
        if (VOWELS.has(normaliseVowel(letters[index]))) return index
    }

    return -1
}

/** Add a tone to a toneless syllable: `hao` + 3 becomes `hǎo`. */
export function applyToneMark(base: string, tone: Tone): string {
    const letters = [...base.toLowerCase()]
    const index = toneVowelIndex(letters)
    if (index < 0) return base

    const vowel = normaliseVowel(letters[index])
    const marks = TONE_MARKS[vowel]
    if (!marks) return base

    letters[index] = marks[tone] ?? vowel
    return letters.join('')
}

/** Compose a reading from syllables, e.g. after changing a tone. */
export function romanizationFromSyllables(
    syllables: RomanizationSyllable[],
    scheme: RomanizationScheme,
): Romanization {
    return {
        scheme,
        marked: syllables.map((syllable) => syllable.marked).join(' '),
        numbered: syllables
            .map((syllable) =>
                syllable.han ? `${syllable.base}${syllable.tone === 0 ? 5 : syllable.tone}` : syllable.base,
            )
            .join(' '),
        syllables,
    }
}

export interface RenderedSyllable {
    /** Syllable text. For superscript style this excludes the tone marker. */
    text: string
    tone: Tone
    /** True when the tone marker must be appended by the caller as a superscript. */
    superscript: boolean
}

/**
 * What comes before each syllable in the written form, so a renderer can put it back.
 *
 * A reading is stored both as a syllable list and as a string, and the string carries the
 * spelling convention of its language: pinyin separates syllables with a space, while
 * Tai-lo and POJ join the syllables of a word with hyphens. Rendering the list with a
 * hard-coded space would quietly turn `sian-senn` into two words, which is a different
 * thing to a reader of either scheme.
 *
 * Recovered from the written form rather than stored per syllable, so it stays correct for
 * data already built and cannot drift from the text it describes.
 */
export function separatorsOf(romanization: Romanization): string[] {
    const separators: string[] = []
    let cursor = 0

    for (const syllable of romanization.syllables) {
        const at = romanization.marked.indexOf(syllable.marked, cursor)
        if (at < 0) {
            // The written form does not contain this syllable verbatim, which should not
            // happen; fall back to a space rather than collapsing the syllables together.
            separators.push(' ')
            continue
        }
        separators.push(romanization.marked.slice(cursor, at))
        cursor = at + syllable.marked.length
    }

    return separators
}

export { isHan } from './han'

/** Unicode superscript for a tone, including 5 for the neutral tone. */
export function toneSuperscript(tone: Tone): string {
    return SUPERSCRIPT[tone] ?? ''
}

export function renderPinyinSyllables(
    romanization: Romanization,
    style: PinyinStyle,
): RenderedSyllable[] {
    return romanization.syllables.map((syllable) => {
        // Tokens that did not come from a Chinese character (ellipses, punctuation,
        // Latin) are passed through untouched and never gain a tone marker.
        if (!syllable.han) {
            return { text: syllable.base, tone: 0 as Tone, superscript: false }
        }

        switch (style) {
            case 'diacritic':
                return { text: syllable.marked, tone: syllable.tone, superscript: false }
            case 'numbers':
                return {
                    text: `${syllable.base}${syllable.tone === 0 ? 5 : syllable.tone}`,
                    tone: syllable.tone,
                    superscript: false,
                }
            case 'superscript':
                return { text: syllable.base, tone: syllable.tone, superscript: true }
        }
    })
}

/** Flat text form, e.g. for `aria-label`, TTS and the review list. */
export function renderPinyinText(romanization: Romanization, style: PinyinStyle): string {
    const separators = separatorsOf(romanization)

    return renderPinyinSyllables(romanization, style)
        .map((syllable, index) => {
            const text = syllable.superscript
                ? `${syllable.text}${SUPERSCRIPT[syllable.tone] ?? ''}`
                : syllable.text
            return `${separators[index] ?? ' '}${text}`
        })
        .join('')
}
