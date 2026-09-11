import { describe, expect, it } from 'vitest'
import {
    answerKindFor,
    faceFor,
    faceKey,
    objectiveLabel,
    promptKindFor,
    taskHintFor,
} from '../../src/domain/faces'
import type { Objective } from '../../src/domain/types'
import { makeEntry } from './fixtures'

const OBJECTIVES: Objective[] = ['zh-en', 'en-zh', 'zh-pinyin', 'pinyin-zh']

describe('prompt and answer kinds', () => {
    it.each(OBJECTIVES)('maps both surfaces for %s', (objective) => {
        expect(promptKindFor(objective)).toBeTruthy()
        expect(answerKindFor(objective)).toBeTruthy()
    })

    it('pairs the surfaces the way each task requires', () => {
        expect([promptKindFor('zh-en'), answerKindFor('zh-en')]).toEqual(['han', 'gloss'])
        expect([promptKindFor('en-zh'), answerKindFor('en-zh')]).toEqual(['gloss', 'han'])
        expect([promptKindFor('zh-pinyin'), answerKindFor('zh-pinyin')]).toEqual(['han', 'pinyin'])
        expect([promptKindFor('pinyin-zh'), answerKindFor('pinyin-zh')]).toEqual(['pinyin', 'han'])
    })
})

describe('taskHintFor', () => {
    it('asks for the pinyin when the answer is pinyin, even though the prompt is characters', () => {
        // Regression: this used to read "Choose the meaning" because the hint was
        // derived from the prompt's surface rather than the objective.
        expect(promptKindFor('zh-pinyin')).toBe('han')
        expect(taskHintFor('zh-pinyin')).toBe('Choose the pinyin')
    })

    it('never tells the player to pick a meaning unless the answers are meanings', () => {
        for (const objective of OBJECTIVES) {
            if (taskHintFor(objective) === 'Choose the meaning') {
                expect(answerKindFor(objective)).toBe('gloss')
            }
        }
    })

    it('gives every objective a distinct, non-empty instruction', () => {
        const hints = OBJECTIVES.map((objective) => taskHintFor(objective))

        for (const hint of hints) expect(hint.length).toBeGreaterThan(0)
        expect(new Set(hints).size).toBeGreaterThanOrEqual(3)
    })

    it('describes each objective', () => {
        expect(objectiveLabel('zh-pinyin')).toBe('Chinese → pinyin')
    })
})

describe('faceFor and faceKey', () => {
    const entry = makeEntry({ simp: '学习', trad: '學習', id: 'xuexi', glossShort: 'to study' })

    it('honours the character set for han faces', () => {
        expect(faceFor(entry, 'han', 'simp').text).toBe('学习')
        expect(faceFor(entry, 'han', 'trad').text).toBe('學習')
    })

    it('carries the pinyin object on pinyin faces', () => {
        const face = faceFor(entry, 'pinyin', 'simp')
        expect(face.text).toBe(entry.pinyin.marked)
        expect(face.pinyin).toBe(entry.pinyin)
    })

    it('keys faces by kind and text so duplicates can be detected', () => {
        expect(faceKey(faceFor(entry, 'gloss', 'simp'))).toBe('gloss:to study')
        expect(faceKey(faceFor(entry, 'han', 'simp'))).not.toBe(
            faceKey(faceFor(entry, 'han', 'trad')),
        )
    })
})
