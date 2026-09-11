import { describe, expect, it } from 'vitest'
import { buildQuestion } from '../../src/domain/distractors'
import { mulberry32 } from '../../src/domain/rng'
import type { Objective, WordEntry } from '../../src/domain/types'
import { makeEntry, makePinyin } from './fixtures'

/** A three-syllable word. */
const LONG = makeEntry({
  simp: '怎么样',
  id: 'zenmeyang',
  pinyin: makePinyin('zen3', 'me5', 'yang4'),
  glossShort: 'how about',
})

/** A different three-syllable word, so it is a legal same-length peer. */
const PEER = makeEntry({
  simp: '图书馆',
  id: 'tushuguan',
  pinyin: makePinyin('tu2', 'shu1', 'guan3'),
  glossShort: 'library',
})

const SHORT_WORDS: WordEntry[] = [
  makeEntry({ simp: '这', id: 'zhe', pinyin: makePinyin('zhe4'), glossShort: 'this' }),
  makeEntry({ simp: '好', id: 'hao', pinyin: makePinyin('hao3'), glossShort: 'good' }),
  makeEntry({ simp: '请', id: 'qing', pinyin: makePinyin('qing3'), glossShort: 'please' }),
]

function syllableCounts(options: { face: { pinyin?: { syllables: unknown[] } } }[]): number[] {
  return options.map((option) => option.face.pinyin?.syllables.length ?? 0)
}

function characterCounts(options: { face: { text: string } }[]): number[] {
  return options.map((option) => Array.from(option.face.text).length)
}

describe('length uniformity', () => {
  it('keeps every pinyin option at the answer syllable count, inventing readings if it must', () => {
    const pool = [LONG, ...SHORT_WORDS]
    const question = buildQuestion({
      entry: LONG,
      objective: 'zh-pinyin',
      pool,
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(9),
    })

    // The list holds no other three-syllable word, so the extras are synthesised.
    expect(question.options).toHaveLength(4)
    expect(syllableCounts(question.options)).toEqual([3, 3, 3, 3])
    expect(question.options.some((option) => option.entry?.id === 'zhe')).toBe(false)
  })

  it('keeps character options at the answer character count, or asks with fewer', () => {
    const pool = [LONG, PEER, ...SHORT_WORDS]
    const question = buildQuestion({
      entry: LONG,
      objective: 'pinyin-zh',
      pool,
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(11),
    })

    // Only one same-length peer exists, so we ask with two rather than four
    // options that would let the player pick the answer by counting characters.
    expect(question.options).toHaveLength(2)
    expect(characterCounts(question.options)).toEqual([3, 3])
  })

  it('applies the same rule to English prompts answered with characters', () => {
    const question = buildQuestion({
      entry: LONG,
      objective: 'en-zh',
      pool: [LONG, PEER, ...SHORT_WORDS],
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(13),
    })

    expect(characterCounts(question.options)).toEqual([3, 3])
  })

  it('leaves gloss answers unconstrained, since their length carries no signal', () => {
    const question = buildQuestion({
      entry: LONG,
      objective: 'zh-en',
      pool: [LONG, ...SHORT_WORDS],
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(15),
    })

    expect(question.options).toHaveLength(4)
    expect(question.options.some((option) => option.face.kind === 'gloss')).toBe(true)
  })

  it('prefers same-length peers over invented readings when they exist', () => {
    const question = buildQuestion({
      entry: LONG,
      objective: 'zh-pinyin',
      pool: [LONG, PEER, ...SHORT_WORDS],
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(17),
    })

    // The real peer is used; only the remaining two slots are synthesised.
    const realOptions = question.options.filter((option) => option.entry !== undefined)
    const syntheticOptions = question.options.filter((option) => option.entry === undefined)
    expect(realOptions.map((option) => option.entry?.id)).toContain(PEER.id)
    expect(syntheticOptions).toHaveLength(2)
  })

  it.each<Objective>(['zh-pinyin', 'pinyin-zh', 'en-zh'])(
    'never lets counting reveal the answer for %s',
    (objective) => {
      const answerFace = buildQuestion({
        entry: LONG,
        objective,
        pool: [LONG, PEER, ...SHORT_WORDS],
        optionCount: 4,
        charset: 'simp',
        rng: mulberry32(19),
      })

      const lengths = new Set(
        objective === 'zh-pinyin' ? syllableCounts(answerFace.options) : characterCounts(answerFace.options),
      )
      expect(lengths.size).toBe(1)
    },
  )
})
