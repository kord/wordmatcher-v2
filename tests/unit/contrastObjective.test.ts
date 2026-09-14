import { describe, expect, it } from 'vitest'
import { buildQuestion } from '../../src/domain/distractors'
import {
    answerKindFor,
    faceFor,
    objectiveLabel,
    promptKindFor,
    taskHintFor,
} from '../../src/domain/faces'
import { chooseObjective, objectivesFor } from '../../src/domain/objectives'
import { mulberry32 } from '../../src/domain/rng'
import type { Objective, Romanization, Tone, WordEntry } from '../../src/domain/types'
import { makeEntry, makePinyin } from './fixtures'

/**
 * The Mandarin -> Taiwanese drill.
 *
 * This is the one question a fluent Mandarin speaker actually needs to be asked: not "what does
 * this character mean" but "you know this word as 吃, now say it in Taiwanese". Its whole value
 * rests on showing the Mandarin form, so the things worth testing are that the prompt really is
 * the Mandarin word, that the answer really is the Taiwanese one, and that the question is never
 * asked of a word where those two would be the same string.
 */

const HAS_HAN = /\p{Script=Han}/u

/**
 * A Tai-lo reading.
 *
 * Unlike `makePinyin` these syllables are spelled out rather than derived, because pinyin's
 * tone-mark placement is not Tai-lo's - the same reason the app ships readings as data instead
 * of regenerating them.
 */
function tailo(...marked: string[]): Romanization {
    return {
        scheme: 'tailo',
        marked: marked.join('-'),
        numbered: marked.join('-'),
        syllables: marked.map((piece) => ({
            base: piece,
            marked: piece,
            tone: 1 as Tone,
            han: true,
        })),
    }
}

/** 吃 -> 食. A different word, so there is something to contrast. */
const EAT = makeEntry({
    id: 'tw-eat',
    language: 'taiwanese',
    simp: '食',
    trad: '食',
    romanizations: { tailo: tailo('tsiah') },
    glossShort: 'eat',
    mandarin: {
        simp: '吃',
        trad: '吃',
        glossShort: 'eat',
        pinyin: makePinyin('chi1'),
        differs: 'word',
    },
})

/** 去 -> 去. The same characters, so only the reading changed - not a contrast question. */
const GO = makeEntry({
    id: 'tw-go',
    language: 'taiwanese',
    simp: '去',
    trad: '去',
    romanizations: { tailo: tailo('khi') },
    glossShort: 'go',
    mandarin: {
        simp: '去',
        trad: '去',
        glossShort: 'go',
        pinyin: makePinyin('qu4'),
        differs: 'reading',
    },
})

const DRINK = makeEntry({
    id: 'tw-drink',
    language: 'taiwanese',
    simp: '啉',
    trad: '啉',
    romanizations: { tailo: tailo('lim') },
    glossShort: 'drink',
    mandarin: {
        simp: '喝',
        trad: '喝',
        glossShort: 'drink',
        pinyin: makePinyin('he1'),
        differs: 'word',
    },
})

/** A plain Mandarin word, which has no counterpart and so nothing to contrast with. */
const PLAIN = makeEntry({
    id: 'zh-eat',
    simp: '吃',
    trad: '吃',
    romanizations: { pinyin: makePinyin('chi1') },
    glossShort: 'eat',
})

/** What a session's pool is: one variety, never a mixture. */
const POOL = [EAT, GO, DRINK]

function ask(entry: WordEntry, pool: readonly WordEntry[] = POOL, seed = 7) {
    return buildQuestion({
        entry,
        objective: 'zh-tw',
        pool,
        optionCount: 4,
        charset: 'trad',
        scheme: 'tailo',
        rng: mulberry32(seed),
    })
}

describe('objectivesFor', () => {
    it('offers the contrast objective only where the characters differ', () => {
        expect(objectivesFor(EAT)).toContain('zh-tw')
        expect(objectivesFor(GO)).not.toContain('zh-tw')
        expect(objectivesFor(PLAIN)).not.toContain('zh-tw')
    })

    it('leaves the four universal objectives alone', () => {
        const universal = ['zh-en', 'en-zh', 'zh-pinyin', 'pinyin-zh']

        expect(objectivesFor(PLAIN)).toEqual(universal)
        expect(objectivesFor(GO)).toEqual(universal)
        expect(objectivesFor(EAT)).toEqual([...universal, 'zh-tw'])
    })
})

describe('chooseObjective', () => {
    it('never asks the contrast question of a word with nothing to contrast', () => {
        for (const entry of [GO, PLAIN]) {
            for (let seed = 0; seed < 100; seed += 1) {
                expect(chooseObjective(mulberry32(seed), entry), entry.id).not.toBe('zh-tw')
            }
        }
    })

    it('takes its share of the draw when the word does differ', () => {
        const drawn = new Set<Objective>()
        for (let seed = 0; seed < 300; seed += 1) {
            drawn.add(chooseObjective(mulberry32(seed), EAT))
        }

        expect(drawn).toContain('zh-tw')
        // Uniform for now, alongside the four that every word can be asked.
        expect(drawn.size).toBe(5)
    })
})

describe('the mandarin face', () => {
    it('shows the Mandarin word the learner already knows', () => {
        expect(faceFor(EAT, 'mandarin', 'trad', 'tailo')).toEqual({ kind: 'mandarin', text: '吃' })
    })

    it('follows the character set', () => {
        const entry = makeEntry({
            simp: '爱',
            trad: '愛',
            romanizations: { tailo: tailo('ai') },
            mandarin: {
                simp: '爱',
                trad: '愛',
                glossShort: 'love',
                pinyin: makePinyin('ai4'),
                differs: 'word',
            },
        })

        expect(faceFor(entry, 'mandarin', 'simp', 'tailo').text).toBe('爱')
        expect(faceFor(entry, 'mandarin', 'trad', 'tailo').text).toBe('愛')
    })

    it('falls back to the entry own characters when there is no counterpart', () => {
        expect(faceFor(PLAIN, 'mandarin', 'simp', 'pinyin').text).toBe('吃')
    })
})

describe('the contrast objective is described', () => {
    it('names the two varieties it switches between', () => {
        expect(objectiveLabel('zh-tw')).toBe('Mandarin → Taiwanese')
    })

    it('asks for the Taiwanese word rather than the meaning', () => {
        expect(promptKindFor('zh-tw')).toBe('mandarin')
        expect(answerKindFor('zh-tw')).toBe('han')
        expect(taskHintFor('zh-tw')).toBe('Choose the Taiwanese word')
    })
})

describe('the contrast question', () => {
    it('asks with the Mandarin word and answers with the Taiwanese one', () => {
        const question = ask(EAT)

        expect(question.prompt.kind).toBe('mandarin')
        expect(question.prompt.text).toBe('吃')
        expect(question.options.find((option) => option.isAnswer)?.face.text).toBe('食')
    })

    it('never shows the answer as its own prompt', () => {
        // The reason the objective is filtered by `differs` in the first place.
        const question = ask(EAT)
        const answer = question.options.find((option) => option.isAnswer)

        expect(question.prompt.text).not.toBe(answer?.face.text)
    })

    it('draws every option from the Taiwanese side, never the Mandarin word', () => {
        const taiwanese = new Set(POOL.map((entry) => entry.trad))

        for (let seed = 0; seed < 20; seed += 1) {
            for (const option of ask(EAT, POOL, seed).options) {
                expect(taiwanese.has(option.face.text), option.face.text).toBe(true)
            }
        }
    })

    it('keeps a word written without characters away from the character options', () => {
        // A Taiwanese word with no settled character answers with its reading. Vowel signs for
        // a lone reading among character words would give the answer away either way round, so
        // it is paired with the other reading instead.
        const negator = makeEntry({
            id: 'tw-neg',
            language: 'taiwanese',
            simp: '',
            trad: '',
            romanizations: { tailo: tailo('m') },
            glossShort: 'not',
            mandarin: {
                simp: '不',
                trad: '不',
                glossShort: 'not',
                pinyin: makePinyin('bu4'),
                differs: 'word',
            },
        })
        const possessive = makeEntry({
            id: 'tw-possessive',
            language: 'taiwanese',
            simp: '',
            trad: '',
            romanizations: { tailo: tailo('e') },
            glossShort: 'possessive',
            mandarin: {
                simp: '的',
                trad: '的',
                glossShort: 'possessive',
                pinyin: makePinyin('de5'),
                differs: 'word',
            },
        })

        const question = ask(negator, [negator, possessive, ...POOL])

        expect(question.options).toHaveLength(2)
        for (const option of question.options) {
            expect(HAS_HAN.test(option.face.text), option.face.text).toBe(false)
        }
    })
})
