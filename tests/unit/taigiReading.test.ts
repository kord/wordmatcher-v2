import { describe, expect, it } from 'vitest'
import { parseReading } from '../../tools/lib/taigiReading'

function tones(text: string): number[] {
    return parseReading(text, 'tailo').syllables.map((syllable) => syllable.tone)
}

describe('parseReading tones', () => {
    it('reads each diacritic as its tone', () => {
        expect(tones('sann')).toEqual([1]) // no mark, open syllable
        expect(tones('kóng')).toEqual([2]) // acute
        expect(tones('hàu')).toEqual([3]) // grave
        expect(tones('tê')).toEqual([5]) // circumflex
        expect(tones('tsia̍h')).toEqual([8]) // vertical line
        expect(tones('pn̄g')).toEqual([7]) // macron
    })

    it('uses the final consonant to tell the 1st and 4th tones apart', () => {
        // Neither carries a diacritic, so only the ending distinguishes them.
        expect(tones('ka')).toEqual([1])
        expect(tones('kah')).toEqual([4])
        expect(tones('tsa̍p')).toEqual([8]) // still 8: the mark wins over the ending
        expect(tones('peh')).toEqual([4])
        expect(tones('la̍k')).toEqual([8])
    })

    it('reads a doubled hyphen as a neutral tone', () => {
        expect(tones('--ah')).toEqual([0])
        expect(tones('khùn--khì')).toEqual([3, 0])
    })
})

describe('parseReading syllables', () => {
    it('splits a word on hyphens and a phrase on spaces', () => {
        expect(parseReading('kin-á-ji̍t', 'tailo').syllables).toHaveLength(3)
        expect(parseReading('bián kheh-khì', 'tailo').syllables).toHaveLength(3)
        expect(tones('tsi̍t-tiám-á')).toEqual([8, 2, 2])
    })

    it('strips the tone mark to give the base', () => {
        expect(parseReading('kóng', 'tailo').syllables[0]?.base).toBe('kong')
        expect(parseReading('tsia̍h', 'tailo').syllables[0]?.base).toBe('tsiah')
        expect(parseReading('pn̄g', 'tailo').syllables[0]?.base).toBe('png')
    })

    it('keeps POJ o-with-dot, which is a vowel rather than a tone mark', () => {
        // U+0358 must survive the tone strip; U+030D, the 8th-tone mark, must not.
        const reading = parseReading('chè-ko͘', 'poj')
        expect(reading.syllables.map((syllable) => syllable.base)).toEqual(['che', 'ko\u0358'])
        expect(reading.syllables.map((syllable) => syllable.tone)).toEqual([3, 1])
    })

    it('keeps POJ superscript n', () => {
        const reading = parseReading('chhiⁿ', 'poj')
        expect(reading.syllables[0]?.base).toBe('chhiⁿ')
        expect(reading.syllables[0]?.tone).toBe(1)
    })
})

describe('parseReading written forms', () => {
    it('leaves the diacritic form exactly as the source wrote it', () => {
        for (const text of ['tsia̍h', 'kin-á-ji̍t', 'bián kheh-khì', 'khùn--khì', 'chè-ko͘']) {
            expect(parseReading(text, 'tailo').marked).toBe(text)
        }
    })

    it('replaces the tone marks with digits and keeps the separators', () => {
        expect(parseReading('kin-á-ji̍t', 'tailo').numbered).toBe('kin1-a2-jit8')
        expect(parseReading('bián kheh-khì', 'tailo').numbered).toBe('bian2 kheh4-khi3')
    })

    it('leaves a neutral syllable as written, since its -- is the mark', () => {
        expect(parseReading('khùn--khì', 'tailo').numbered).toBe('khun3--khi')
    })

    it('records the scheme it was parsed for', () => {
        expect(parseReading('tsia̍h', 'tailo').scheme).toBe('tailo')
        expect(parseReading('chia̍h', 'poj').scheme).toBe('poj')
    })

    it('gives every syllable a base that is a substring of its written form', () => {
        for (const syllable of parseReading('tsi̍t-tiám-á', 'tailo').syllables) {
            expect(syllable.base.length).toBeGreaterThan(0)
            expect(syllable.han).toBe(true)
        }
    })
})
