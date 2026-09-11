import { describe, expect, it } from 'vitest'
import { isHan, renderPinyinSyllables, renderPinyinText } from '../../src/domain/pinyin'
import type { Pinyin } from '../../src/domain/types'
import { makePinyin } from './fixtures'

const HELLO: Pinyin = {
  marked: 'nǐ hǎo',
  numbered: 'ni3 hao3',
  syllables: [
    { base: 'ni', marked: 'nǐ', tone: 3, han: true },
    { base: 'hao', marked: 'hǎo', tone: 3, han: true },
  ],
}

const NEUTRAL: Pinyin = {
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
    const withEllipsis: Pinyin = {
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
