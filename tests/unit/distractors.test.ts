import { describe, expect, it } from 'vitest'
import { buildQuestion } from '../../src/domain/distractors'
import { answerKindFor, faceFor, promptKindFor } from '../../src/domain/faces'
import { mulberry32 } from '../../src/domain/rng'
import type { CharacterSet, Objective, WordEntry } from '../../src/domain/types'
import { makeEntry, makePinyin } from './fixtures'

function pool(): WordEntry[] {
  return [
    makeEntry({ simp: '爱', trad: '愛', id: 'ai', glossShort: 'to love', hsk: 1, pinyin: makePinyin('ai4') }),
    makeEntry({ simp: '恨', trad: '恨', id: 'hen', glossShort: 'to hate', hsk: 1, pinyin: makePinyin('hen4') }),
    makeEntry({ simp: '想', trad: '想', id: 'xiang', glossShort: 'to want', hsk: 1, pinyin: makePinyin('xiang3') }),
    makeEntry({ simp: '看', trad: '看', id: 'kan', glossShort: 'to look', hsk: 1, pinyin: makePinyin('kan4') }),
    makeEntry({ simp: '听', trad: '聽', id: 'ting', glossShort: 'to listen', hsk: 1, pinyin: makePinyin('ting1') }),
    makeEntry({ simp: '说', trad: '說', id: 'shuo', glossShort: 'to speak', hsk: 1, pinyin: makePinyin('shuo1') }),
  ]
}

const OBJECTIVES: Objective[] = ['zh-en', 'en-zh', 'zh-pinyin', 'pinyin-zh']

describe('buildQuestion', () => {
  it.each(OBJECTIVES)('builds a well-formed question for %s', (objective) => {
    const entries = pool()
    const question = buildQuestion({
      entry: entries[0],
      objective,
      pool: entries,
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(1),
    })

    expect(question.options).toHaveLength(4)
    expect(question.options.filter((option) => option.isAnswer)).toHaveLength(1)
    expect(question.prompt.kind).toBe(promptKindFor(objective))
    expect(question.prompt.text.length).toBeGreaterThan(0)

    for (const option of question.options) {
      expect(option.face.kind).toBe(answerKindFor(objective))
      expect(option.face.text.length).toBeGreaterThan(0)
    }

    const answer = question.options.find((option) => option.isAnswer)
    expect(answer?.entry?.id).toBe(entries[0].id)
  })

  it('never presents two options that read the same', () => {
    const entries = [
      makeEntry({ simp: '爱', id: 'ai', glossShort: 'to love' }),
      makeEntry({ simp: '恋', id: 'lian', glossShort: 'to love' }),
      makeEntry({ simp: '喜', id: 'xi', glossShort: 'to love' }),
      makeEntry({ simp: '恨', id: 'hen', glossShort: 'to hate' }),
      makeEntry({ simp: '想', id: 'xiang', glossShort: 'to want' }),
    ]

    for (let seed = 0; seed < 25; seed++) {
      const question = buildQuestion({
        entry: entries[0],
        objective: 'zh-en',
        pool: entries,
        optionCount: 4,
        charset: 'simp',
        rng: mulberry32(seed),
      })

      const texts = question.options.map((option) => option.face.text)
      expect(new Set(texts).size).toBe(texts.length)
      expect([...texts].sort()).toEqual(['to hate', 'to love', 'to want'])
    }
  })

  it('presents fewer options rather than looping when the pool is tiny', () => {
    const entries = pool().slice(0, 2)
    const question = buildQuestion({
      entry: entries[0],
      objective: 'zh-en',
      pool: entries,
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(3),
    })

    expect(question.options).toHaveLength(2)
    expect(question.options.filter((option) => option.isAnswer)).toHaveLength(1)
  })

  it('respects the requested character set', () => {
    const entries = pool()
    const build = (charset: CharacterSet) =>
      buildQuestion({
        entry: entries[0],
        objective: 'en-zh',
        pool: entries,
        optionCount: 4,
        charset,
        rng: mulberry32(5),
      })

    const simplified = build('simp')
    const traditional = build('trad')

    expect(faceFor(entries[0], 'han', 'simp').text).toBe('爱')
    expect(faceFor(entries[0], 'han', 'trad').text).toBe('愛')
    expect(simplified.options.some((option) => option.face.text === '爱')).toBe(true)
    expect(traditional.options.some((option) => option.face.text === '愛')).toBe(true)
    expect(traditional.options.some((option) => option.face.text === '爱')).toBe(false)
  })

  it('carries pinyin data on pinyin faces', () => {
    const entries = pool()
    const question = buildQuestion({
      entry: entries[0],
      objective: 'zh-pinyin',
      pool: entries,
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(11),
    })

    for (const option of question.options) {
      expect(option.face.pinyin).toBeDefined()
      expect(option.face.pinyin?.syllables.length).toBeGreaterThan(0)
    }
  })

  it('varies the answer position across builds', () => {
    const entries = pool()
    const positions = new Set<number>()

    for (let seed = 0; seed < 40; seed++) {
      const question = buildQuestion({
        entry: entries[0],
        objective: 'zh-en',
        pool: entries,
        optionCount: 4,
        charset: 'simp',
        rng: mulberry32(seed),
      })
      positions.add(question.options.findIndex((option) => option.isAnswer))
    }

    expect(positions.size).toBeGreaterThan(1)
  })

  it('can source distractors from a pool that excludes the answer', () => {
    // A mistake-review session may hold one word, so distractors come from the
    // wider studied list instead.
    const entries = pool()
    const lone = entries[0]

    const question = buildQuestion({
      entry: lone,
      objective: 'zh-en',
      pool: entries.slice(1),
      optionCount: 4,
      charset: 'simp',
      rng: mulberry32(17),
    })

    expect(question.options).toHaveLength(4)
    expect(question.options.filter((option) => option.isAnswer)).toHaveLength(1)
    expect(question.options.find((option) => option.isAnswer)?.entry?.id).toBe(lone.id)
  })

  it('prefers distractors at the same level and syllable count', () => {
    const answer = makeEntry({ simp: '甲', id: 'target', glossShort: 'target', hsk: 2, pinyin: makePinyin('jia3') })
    const sameLevelSameLength = makeEntry({ simp: '乙', id: 'near-a', glossShort: 'near a', hsk: 2, pinyin: makePinyin('yi3') })
    const sameLevelSameLength2 = makeEntry({ simp: '丙', id: 'near-b', glossShort: 'near b', hsk: 2, pinyin: makePinyin('bing3') })
    const farAway = makeEntry({ simp: '丁戊己', id: 'far-a', glossShort: 'far a', hsk: 6, pinyin: makePinyin('ding1', 'wu4', 'ji3') })
    const farAway2 = makeEntry({ simp: '庚辛壬', id: 'far-b', glossShort: 'far b', hsk: 6, pinyin: makePinyin('geng1', 'xin1', 'ren2') })

    const rng = mulberry32(21)
    let nearPicks = 0
    let farPicks = 0

    for (let i = 0; i < 200; i++) {
      const question = buildQuestion({
        entry: answer,
        objective: 'zh-en',
        pool: [answer, sameLevelSameLength, sameLevelSameLength2, farAway, farAway2],
        optionCount: 3,
        charset: 'simp',
        rng,
      })
      for (const option of question.options) {
        if (option.isAnswer) continue
        if (option.entry?.id?.startsWith('near')) nearPicks++
        if (option.entry?.id?.startsWith('far')) farPicks++
      }
    }

    expect(nearPicks).toBeGreaterThan(farPicks * 3)
  })
})
