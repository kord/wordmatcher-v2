import { describe, expect, it } from 'vitest'
import {
    BOX_WEIGHTS,
    INTERVALS_MS,
    NOVELTY_WEIGHT,
    UNDUE_FLOOR,
    WRONG_AGAIN_MS,
} from '../../src/domain/constants'
import { mulberry32 } from '../../src/domain/rng'
import {
    applyOutcome,
    createProgress,
    isMastered,
    pickNextWord,
    scoreCandidate,
} from '../../src/domain/scheduler'
import { makeEntry, makeProgress } from './fixtures'

const NOW = 1_700_000_000_000

describe('createProgress', () => {
    it('starts unseen and immediately due', () => {
        const record = createProgress('w1', NOW)
        expect(record.seen).toBe(0)
        expect(record.box).toBe(0)
        expect(record.dueAt).toBe(NOW)
        expect(isMastered(record)).toBe(false)
    })
})

describe('scoreCandidate', () => {
    it('boosts unseen words above a due weak word', () => {
        const unseen = scoreCandidate(undefined, NOW)
        const dueWeak = scoreCandidate(makeProgress({ wordId: 'a', box: 0, seen: 3, dueAt: NOW }), NOW)

        expect(unseen).toBeGreaterThan(dueWeak)
        expect(unseen).toBe(scoreCandidate(makeProgress({ wordId: 'b', seen: 0 }), NOW))
    })

    it('penalises words that are not due yet', () => {
        const due = scoreCandidate(makeProgress({ wordId: 'a', box: 1, seen: 2, dueAt: NOW }), NOW)
        const future = scoreCandidate(
            makeProgress({ wordId: 'b', box: 1, seen: 2, dueAt: NOW + 60_000 }),
            NOW,
        )

        expect(future).toBeLessThan(due)
        expect(future / due).toBeCloseTo(UNDUE_FLOOR, 5)
    })

    it('prefers weaker boxes over stronger ones', () => {
        const weak = scoreCandidate(makeProgress({ wordId: 'a', box: 0, seen: 4, dueAt: NOW }), NOW)
        const strong = scoreCandidate(makeProgress({ wordId: 'b', box: 5, seen: 4, dueAt: NOW }), NOW)
        expect(weak).toBeGreaterThan(strong)
    })

    it('saturates the overdue bonus after a few days', () => {
        const oneDay = scoreCandidate(
            makeProgress({ wordId: 'a', box: 2, seen: 2, dueAt: NOW - 86_400_000 }),
            NOW,
        )
        const tenDays = scoreCandidate(
            makeProgress({ wordId: 'b', box: 2, seen: 2, dueAt: NOW - 10 * 86_400_000 }),
            NOW,
        )
        expect(tenDays).toBeGreaterThan(oneDay)
        const thirtyDays = scoreCandidate(
            makeProgress({ wordId: 'c', box: 2, seen: 2, dueAt: NOW - 30 * 86_400_000 }),
            NOW,
        )
        expect(thirtyDays).toBe(tenDays)
    })

    it('uses the novelty multiplier for unseen words', () => {
        expect(scoreCandidate(undefined, NOW)).toBe(BOX_WEIGHTS[0] * NOVELTY_WEIGHT)
    })
})

describe('applyOutcome', () => {
    it('does not promote on a single correct answer', () => {
        const start = createProgress('w1', NOW)
        const once = applyOutcome(start, 'correct', NOW, 1200)

        expect(once.box).toBe(0)
        expect(once.correctStreak).toBe(1)
        expect(once.correct).toBe(1)
        expect(once.seen).toBe(1)
        expect(once.dueAt).toBe(NOW + INTERVALS_MS[0])
        expect(once.totalMs).toBe(1200)
    })

    it('promotes after the required streak and resets the streak', () => {
        let record = createProgress('w1', NOW)
        record = applyOutcome(record, 'correct', NOW, 1000)
        record = applyOutcome(record, 'correct', NOW, 1000)

        expect(record.box).toBe(1)
        expect(record.correctStreak).toBe(0)
        expect(record.dueAt).toBe(NOW + INTERVALS_MS[1])
    })

    it('promotes repeatedly over consecutive correct answers', () => {
        let record = createProgress('w1', NOW)
        for (let i = 0; i < 4; i++) record = applyOutcome(record, 'correct', NOW, 1000)

        expect(record.box).toBe(2)
        expect(record.correct).toBe(4)
    })

    it('demotes and re-queues quickly on a miss', () => {
        const start = makeProgress({ wordId: 'w1', box: 2, correctStreak: 1, seen: 5, correct: 4 })
        const missed = applyOutcome(start, 'incorrect', NOW, 2500)

        expect(missed.box).toBe(1)
        expect(missed.correctStreak).toBe(0)
        expect(missed.lapses).toBe(1)
        expect(missed.dueAt).toBe(NOW + WRONG_AGAIN_MS)
        expect(missed.correct).toBe(4)
        expect(missed.seen).toBe(6)
    })

    it('never demotes below box 0', () => {
        const start = makeProgress({ wordId: 'w1', box: 0, seen: 1 })
        expect(applyOutcome(start, 'incorrect', NOW, 500).box).toBe(0)
    })

    it('never promotes above the maximum box', () => {
        let record = makeProgress({ wordId: 'w1', box: 5, seen: 10, correct: 10 })
        record = applyOutcome(record, 'correct', NOW, 500)
        record = applyOutcome(record, 'correct', NOW, 500)
        expect(record.box).toBe(5)
        expect(isMastered(record)).toBe(true)
    })
})

describe('pickNextWord', () => {
    const pool = Array.from({ length: 40 }, (_, index) =>
        makeEntry({ simp: `字${index}`, id: `w${index}` }),
    )

    it('returns undefined for an empty pool', () => {
        expect(pickNextWord([], new Map(), [], mulberry32(1), NOW)).toBeUndefined()
    })

    it('never returns a recently shown word', () => {
        const recent = pool.slice(0, 20).map((entry) => entry.id)
        const progress = new Map(pool.map((entry) => [entry.id, makeProgress({ wordId: entry.id })]))
        const rng = mulberry32(42)

        for (let i = 0; i < 200; i++) {
            const picked = pickNextWord(pool, progress, recent, rng, NOW)
            expect(picked).toBeDefined()
            expect(recent).not.toContain(picked?.id)
        }
    })

    it('falls back to the full pool when everything is excluded', () => {
        const allIds = pool.map((entry) => entry.id)
        const picked = pickNextWord(pool, new Map(), allIds, mulberry32(7), NOW)
        expect(picked).toBeDefined()
    })

    it('draws weak words far more often than mastered ones', () => {
        const weak = makeEntry({ simp: '弱', id: 'weak' })
        const strong = makeEntry({ simp: '强', id: 'strong' })
        const progress = new Map([
            [weak.id, makeProgress({ wordId: 'weak', box: 0, seen: 4, dueAt: NOW })],
            [strong.id, makeProgress({ wordId: 'strong', box: 5, seen: 40, correct: 38, dueAt: NOW })],
        ])

        const rng = mulberry32(1234)
        let weakPicks = 0
        let strongPicks = 0

        for (let i = 0; i < 600; i++) {
            const picked = pickNextWord([weak, strong], progress, [], rng, NOW)
            if (picked?.id === 'weak') weakPicks++
            if (picked?.id === 'strong') strongPicks++
        }

        expect(weakPicks + strongPicks).toBe(600)
        expect(weakPicks).toBeGreaterThan(strongPicks * 5)
    })

    it('is deterministic for a given seed', () => {
        const progress = new Map(pool.map((entry) => [entry.id, makeProgress({ wordId: entry.id })]))
        const first = pickNextWord(pool, progress, [], mulberry32(99), NOW)
        const second = pickNextWord(pool, progress, [], mulberry32(99), NOW)
        expect(first?.id).toBe(second?.id)
    })
})
