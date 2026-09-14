import { beforeEach, describe, expect, it } from 'vitest'
import type { Language, StoredSession } from '../../src/domain/types'
import { resetDbForTests } from '../../src/storage/db'
import { loadProgress, resetProgress, saveProgress } from '../../src/storage/progressRepo'
import { loadSessions, resetSessions, saveSession } from '../../src/storage/sessionRepo'
import { makeProgress } from './fixtures'

/**
 * The separation between the two varieties is the one thing a learner would notice
 * immediately if it broke: drilling Taiwanese would start moving their Mandarin numbers.
 *
 * jsdom has no IndexedDB, so these run against the in-memory fallback in `db.ts`. The
 * filtering being tested lives in the repositories, above that seam, so it is the same
 * code either way.
 */
function session(id: string, language: Language, startedAt: number): StoredSession {
    return {
        id,
        language,
        startedAt,
        finishedAt: startedAt + 1000,
        summary: {
            total: 1,
            correct: 1,
            incorrect: 0,
            longestStreak: 1,
            durationMs: 1000,
            mistakes: [],
            listNames: ['test'],
        },
    }
}

beforeEach(() => {
    resetDbForTests()
})

describe('progress is scoped by language', () => {
    it('reads back only the variety asked for', async () => {
        await saveProgress([
            makeProgress({ wordId: 'a', language: 'mandarin' }),
            makeProgress({ wordId: 'b', language: 'taiwanese' }),
        ])

        expect([...(await loadProgress('mandarin')).keys()]).toEqual(['a'])
        expect([...(await loadProgress('taiwanese')).keys()]).toEqual(['b'])
    })

    it('erases one variety and leaves the other alone', async () => {
        await saveProgress([
            makeProgress({ wordId: 'a', language: 'mandarin' }),
            makeProgress({ wordId: 'b', language: 'taiwanese' }),
        ])

        await resetProgress('taiwanese')

        expect([...(await loadProgress('mandarin')).keys()]).toEqual(['a'])
        expect([...(await loadProgress('taiwanese')).keys()]).toEqual([])
    })
})

describe('session history is scoped by language', () => {
    it('lists only the variety asked for, most recent first', async () => {
        await saveSession(session('m1', 'mandarin', 1))
        await saveSession(session('m2', 'mandarin', 3))
        await saveSession(session('t1', 'taiwanese', 2))

        expect((await loadSessions('mandarin')).map((entry) => entry.id)).toEqual(['m2', 'm1'])
        expect((await loadSessions('taiwanese')).map((entry) => entry.id)).toEqual(['t1'])
    })

    it('erases one variety and leaves the other alone', async () => {
        await saveSession(session('m1', 'mandarin', 1))
        await saveSession(session('t1', 'taiwanese', 2))

        await resetSessions('mandarin')

        expect(await loadSessions('mandarin')).toEqual([])
        expect((await loadSessions('taiwanese')).map((entry) => entry.id)).toEqual(['t1'])
    })
})
