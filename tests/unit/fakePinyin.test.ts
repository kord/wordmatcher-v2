import { describe, expect, it } from 'vitest'
import { syntheticPinyinOptions } from '../../src/domain/fakePinyin'
import { mulberry32 } from '../../src/domain/rng'
import type { Romanization } from '../../src/domain/types'

const HOW_ABOUT: Romanization = {
    scheme: 'pinyin',
    marked: 'zěn me yàng',
    numbered: 'zen3 me5 yang4',
    syllables: [
        { base: 'zen', marked: 'zěn', tone: 3, han: true },
        { base: 'me', marked: 'me', tone: 0, han: true },
        { base: 'yang', marked: 'yàng', tone: 4, han: true },
    ],
}

function generate(count: number, taken = new Set<string>(), seed = 5): Romanization[] {
    return syntheticPinyinOptions({ answer: HOW_ABOUT, count, taken, rng: mulberry32(seed) })
}

describe('syntheticPinyinOptions', () => {
    it('always keeps the answer syllable count', () => {
        for (let seed = 0; seed < 25; seed++) {
            for (const reading of generate(3, new Set<string>(), seed)) {
                expect(reading.syllables).toHaveLength(3)
            }
        }
    })

    it('produces the requested number of readings', () => {
        expect(generate(3)).toHaveLength(3)
        expect(generate(1)).toHaveLength(1)
        expect(generate(0)).toHaveLength(0)
    })

    it('never repeats the answer', () => {
        for (const reading of generate(12)) {
            expect(reading.marked).not.toBe(HOW_ABOUT.marked)
        }
    })

    it('never repeats an option already on screen', () => {
        // Claim the answer and one plausible synthesis, then make sure neither returns.
        const taken = new Set(['romanization:zěn me yàng', 'romanization:zèn me yàng'])
        for (const reading of generate(8, taken)) {
            expect(taken.has(`romanization:${reading.marked}`)).toBe(false)
        }
    })

    it('produces distinct readings', () => {
        const readings = generate(6)
        const marked = readings.map((reading) => reading.marked)
        expect(new Set(marked).size).toBe(marked.length)
    })

    it('keeps the numbered form consistent with the marked form', () => {
        for (const reading of generate(4)) {
            const syllables = reading.numbered.split(' ')
            expect(syllables).toHaveLength(reading.syllables.length)
            expect(syllables[3 - 1]).toBeDefined()
        }
    })

    it('is deterministic for a seed', () => {
        expect(generate(3, new Set<string>(), 42).map((r) => r.marked)).toEqual(
            generate(3, new Set<string>(), 42).map((r) => r.marked),
        )
    })

    it('reorders the syllables, so at least one option is a re-ordering', () => {
        const readings = generate(12)
        const reordered = readings.filter((reading) => {
            const bases = reading.syllables.map((syllable) => syllable.base)
            return bases.join() !== HOW_ABOUT.syllables.map((syllable) => syllable.base).join()
        })
        expect(reordered.length).toBeGreaterThan(0)
    })

    it('returns nothing when there is nothing safe to change', () => {
        const punctuation: Romanization = {
            scheme: 'pinyin',
            marked: '…',
            numbered: '…',
            syllables: [{ base: '…', marked: '…', tone: 0, han: false }],
        }
        const readings = syntheticPinyinOptions({
            answer: punctuation,
            count: 3,
            taken: new Set<string>(),
            rng: mulberry32(1),
        })
        expect(readings).toEqual([])
    })

    it('can still vary a single neutral-tone syllable', () => {
        const neutral: Romanization = {
            scheme: 'pinyin',
            marked: 'de',
            numbered: 'de5',
            syllables: [{ base: 'de', marked: 'de', tone: 0, han: true }],
        }
        const readings = syntheticPinyinOptions({
            answer: neutral,
            count: 2,
            taken: new Set<string>(),
            rng: mulberry32(3),
        })

        expect(readings).toHaveLength(2)
        for (const reading of readings) {
            expect(reading.syllables).toHaveLength(1)
            expect(reading.marked).not.toBe('de')
        }
    })
})
