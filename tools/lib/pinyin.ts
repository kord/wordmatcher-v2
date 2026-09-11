import { pinyin as toPinyin } from 'pinyin-pro'
import { isHan } from '../../src/domain/han.ts'
import type { Pinyin, PinyinSyllable, Tone } from '../../src/domain/types.ts'

/**
 * Build the per-syllable shape once, at build time, so the client never needs a
 * pinyin library. Every display style (diacritics, tone numbers, superscripts,
 * tone colouring) is derived from the same fields.
 */
const TRAILING_TONE_DIGIT = /(\d)$/

/** A romanised syllable, as opposed to a punctuation or Latin token. */
const PINYIN_LETTERS = /^[a-zA-ZüÜ]+$/

/** `pinyin-pro` is typed as returning `string | string[]`; normalise defensively. */
function toArray(result: string | string[]): string[] {
    return Array.isArray(result) ? result : [result]
}

function parseTone(numbered: string): Tone {
    const match = TRAILING_TONE_DIGIT.exec(numbered)
    if (!match) return 0
    const value = Number(match[1])
    // pinyin-pro emits 5 for the neutral tone.
    return value >= 1 && value <= 4 ? (value as Tone) : 0
}

export function buildPinyin(word: string): Pinyin {
    const marked = toArray(toPinyin(word, { type: 'array' }))
    const numbered = toArray(toPinyin(word, { type: 'array', toneType: 'num' }))
    const base = toArray(toPinyin(word, { type: 'array', toneType: 'none' }))

    const count = Math.min(marked.length, numbered.length, base.length)
    const characters = Array.from(word)
    // Syllables are usually one per character, which lets us ask the source text
    // directly whether a syllable came from a Chinese character.
    const alignedWithCharacters = characters.length === count

    const syllables: PinyinSyllable[] = []

    for (let i = 0; i < count; i++) {
        const syllableBase = base[i]
        const han = alignedWithCharacters ? isHan(characters[i]) : PINYIN_LETTERS.test(syllableBase)

        syllables.push({
            base: syllableBase,
            marked: marked[i],
            tone: parseTone(numbered[i]),
            han,
        })
    }

    return {
        marked: syllables.map((syllable) => syllable.marked).join(' '),
        numbered: numbered.join(' '),
        syllables,
    }
}
