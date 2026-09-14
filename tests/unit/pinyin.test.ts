import { describe, expect, it } from 'vitest'
import {
    applyToneMark,
    isHan,
    renderPinyinSyllables,
    renderPinyinText,
    romanizationFromSyllables,
    separatorsOf,
} from '../../src/domain/pinyin'
import type { Romanization } from '../../src/domain/types'
import { makePinyin } from './fixtures'

const HELLO: Romanization = {
    scheme: 'pinyin',
    marked: 'nǐ hǎo',
    numbered: 'ni3 hao3',
    syllables: [
        { base: 'ni', marked: 'nǐ', tone: 3, han: true },
        { base: 'hao', marked: 'hǎo', tone: 3, han: true },
    ],
}

const NEUTRAL: Romanization = {
    scheme: 'pinyin',
    marked: 'mā ma',
    numbered: 'ma1 ma5',
    syllables: [
        { base: 'ma', marked: 'mā', tone: 1, han: true },
        { base: 'ma', marked: 'ma', tone: 0, han: true },
    ],
}

describe('isHan', () => {
    it('detects Chinese characters and rejects other tokens', () => {
        expect(isHan('我')).toBe(true)
        expect(isHan('…')).toBe(false)
        expect(isHan('A')).toBe(false)
    })
})

describe('renderPinyinSyllables', () => {
    it('renders tone-marked diacritics by default', () => {
        expect(renderPinyinSyllables(HELLO, 'diacritic')).toEqual([
            { text: 'nǐ', tone: 3, superscript: false },
            { text: 'hǎo', tone: 3, superscript: false },
        ])
    })

    it('renders numbered syllables, using 5 for the neutral tone', () => {
        expect(renderPinyinSyllables(NEUTRAL, 'numbers')).toEqual([
            { text: 'ma1', tone: 1, superscript: false },
            { text: 'ma5', tone: 0, superscript: false },
        ])
    })

    it('splits the tone out for superscript style', () => {
        expect(renderPinyinSyllables(HELLO, 'superscript')).toEqual([
            { text: 'ni', tone: 3, superscript: true },
            { text: 'hao', tone: 3, superscript: true },
        ])
    })

    it('passes non-Chinese tokens through untouched', () => {
        const withEllipsis: Romanization = {
            scheme: 'pinyin',
            marked: 'bú dàn …',
            numbered: 'bu2 dan4 …',
            syllables: [
                { base: 'bu', marked: 'bú', tone: 2, han: true },
                { base: 'dan', marked: 'dàn', tone: 4, han: true },
                { base: '…', marked: '…', tone: 0, han: false },
            ],
        }

        expect(renderPinyinSyllables(withEllipsis, 'numbers')).toEqual([
            { text: 'bu2', tone: 2, superscript: false },
            { text: 'dan4', tone: 4, superscript: false },
            { text: '…', tone: 0, superscript: false },
        ])
        expect(renderPinyinSyllables(withEllipsis, 'superscript')[2]).toEqual({
            text: '…',
            tone: 0,
            superscript: false,
        })
    })
})

describe('renderPinyinText', () => {
    it('joins syllables with spaces for each style', () => {
        expect(renderPinyinText(HELLO, 'diacritic')).toBe('nǐ hǎo')
        expect(renderPinyinText(HELLO, 'numbers')).toBe('ni3 hao3')
        expect(renderPinyinText(HELLO, 'superscript')).toBe('ni³ hao³')
    })

    it('keeps neutral tones explicit in numbered style', () => {
        expect(renderPinyinText(NEUTRAL, 'numbers')).toBe('ma1 ma5')
        expect(renderPinyinText(NEUTRAL, 'superscript')).toBe('ma¹ ma⁵')
    })

    it('does not invent tone markers for non-Chinese tokens', () => {
        expect(renderPinyinText(makePinyin('ai4', 'qing2'), 'superscript')).toBe('ai⁴ qing²')
    })
})

describe('applyToneMark', () => {
    it('puts the mark on a when there is one', () => {
        expect(applyToneMark('hao', 3)).toBe('hǎo')
        expect(applyToneMark('zhang', 1)).toBe('zhāng')
    })

    it('prefers o, then e, when there is no a', () => {
        expect(applyToneMark('zhong', 1)).toBe('zhōng')
        expect(applyToneMark('xie', 4)).toBe('xiè')
    })

    it('marks the last vowel for iu and ui', () => {
        expect(applyToneMark('liu', 2)).toBe('liú')
        expect(applyToneMark('gui', 4)).toBe('guì')
    })

    it('marks ü, whether written with an umlaut or a v', () => {
        expect(applyToneMark('lü', 3)).toBe('lǚ')
        expect(applyToneMark('lv', 3)).toBe('lǚ')
    })

    it('leaves a neutral tone unmarked', () => {
        expect(applyToneMark('de', 0)).toBe('de')
    })

    it('returns the input when there is no vowel to mark', () => {
        expect(applyToneMark('…', 2)).toBe('…')
        expect(applyToneMark('ng', 2)).toBe('ng')
    })
})

describe('romanizationFromSyllables', () => {
    it('joins the marked and numbered forms', () => {
        const reading = romanizationFromSyllables(
            [
                { base: 'ni', marked: 'nǐ', tone: 3, han: true },
                { base: 'hao', marked: 'hǎo', tone: 3, han: true },
            ],
            'pinyin',
        )

        expect(reading.marked).toBe('nǐ hǎo')
        expect(reading.numbered).toBe('ni3 hao3')
        expect(reading.scheme).toBe('pinyin')
    })

    it('writes the neutral tone as 5 and passes other tokens through', () => {
        const reading = romanizationFromSyllables(
            [
                { base: 'ma', marked: 'ma', tone: 0, han: true },
                { base: '…', marked: '…', tone: 0, han: false },
            ],
            'pinyin',
        )

        expect(reading.numbered).toBe('ma5 …')
    })
})

describe('separatorsOf', () => {
    it('recovers the spaces pinyin separates its syllables with', () => {
        expect(separatorsOf(HELLO)).toEqual(['', ' '])
        expect(renderPinyinText(HELLO, 'diacritic')).toBe('nǐ hǎo')
    })

    it('recovers the hyphens a Tai-lo word joins its syllables with', () => {
        // Rendering this with a space would read as two words rather than one.
        const reading: Romanization = {
            scheme: 'tailo',
            marked: 'sian-senn',
            numbered: 'sian1-senn7',
            syllables: [
                { base: 'sian', marked: 'sian', tone: 1, han: true },
                { base: 'senn', marked: 'senn', tone: 7, han: true },
            ],
        }

        expect(separatorsOf(reading)).toEqual(['', '-'])
        expect(renderPinyinText(reading, 'diacritic')).toBe('sian-senn')
    })

    it('leaves a neutral syllable carrying its own marker', () => {
        const reading: Romanization = {
            scheme: 'tailo',
            marked: 'khùn--khì',
            numbered: 'khun3',
            syllables: [
                { base: 'khun', marked: 'khùn', tone: 3, han: true },
                { base: 'khi', marked: '--khì', tone: 0, han: true },
            ],
        }

        expect(separatorsOf(reading)).toEqual(['', ''])
        expect(renderPinyinText(reading, 'diacritic')).toBe('khùn--khì')
    })

    it('falls back to a space if a syllable is not found in the written form', () => {
        const inconsistent: Romanization = {
            scheme: 'pinyin',
            marked: 'nǐ hǎo',
            numbered: 'ni3 hao3',
            syllables: [
                { base: 'ni', marked: 'nǐ', tone: 3, han: true },
                { base: 'hao', marked: 'hào', tone: 4, han: true },
            ],
        }

        expect(separatorsOf(inconsistent)).toEqual(['', ' '])
    })
})
