import type { Pinyin, PinyinStyle, Tone } from './types'

/**
 * Pinyin is stored per syllable at build time, so every display style is a pure
 * transformation here - no conversion library and no runtime cost.
 */
const SUPERSCRIPT: Record<number, string> = { 0: '⁵', 1: '¹', 2: '²', 3: '³', 4: '⁴' }

export interface RenderedSyllable {
  /** Syllable text. For superscript style this excludes the tone marker. */
  text: string
  tone: Tone
  /** True when the tone marker must be appended by the caller as a superscript. */
  superscript: boolean
}

export { isHan } from './han'

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
