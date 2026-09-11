import type { Pinyin, PinyinSyllable, PinyinStyle, Tone } from './types'

/**
 * Pinyin is stored per syllable at build time, so every display style is a pure
 * transformation here - no conversion library and no runtime cost.
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
export function pinyinFromSyllables(syllables: PinyinSyllable[]): Pinyin {
  return {
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

export { isHan } from './han'

/** Unicode superscript for a tone, including 5 for the neutral tone. */
export function toneSuperscript(tone: Tone): string {
  return SUPERSCRIPT[tone] ?? ''
}

export function renderPinyinSyllables(pinyin: Pinyin, style: PinyinStyle): RenderedSyllable[] {
  return pinyin.syllables.map((syllable) => {
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
export function renderPinyinText(pinyin: Pinyin, style: PinyinStyle): string {
  return renderPinyinSyllables(pinyin, style)
    .map((syllable) =>
      syllable.superscript ? `${syllable.text}${SUPERSCRIPT[syllable.tone] ?? ''}` : syllable.text,
    )
    .join(' ')
}
