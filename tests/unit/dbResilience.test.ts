import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORE_PROGRESS, isIndexedDbAvailable, resetDbForTests, writeMany } from '../../src/storage/db'
import { loadProgress } from '../../src/storage/progressRepo'
import { makeProgress } from './fixtures'

/**
 * An IndexedDB that accepts the open and then says nothing at all.
 *
 * This is what a wedged connection actually looks like, and it is nastier than a failure: no
 * success, no error, and no `blocked` event either, because `blocked` only ever reports a version
 * change. Without a timeout the app waits here for ever, and the start button reads
 * "Preparing..." indefinitely - which is the one thing a first-time user must never see.
 */
const SILENT = { open: () => ({}) }

beforeEach(() => {
    resetDbForTests()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    resetDbForTests()
})

describe('when IndexedDB stops responding', () => {
    it('gives up waiting and keeps working in memory', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('indexedDB', SILENT)

        // Present, so the availability check passes and the operation reaches the real open path.
        expect(isIndexedDbAvailable()).toBe(true)

        const writing = writeMany(STORE_PROGRESS, [makeProgress({ wordId: 'a' })])
        await vi.advanceTimersByTimeAsync(3100)
        await writing

        // The write landed somewhere: the app lost persistence, not the session.
        const records = await loadProgress('mandarin')
        expect([...records.keys()]).toEqual(['a'])
    })

    it('stops trying, so every later call is immediate', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('indexedDB', SILENT)

        const first = writeMany(STORE_PROGRESS, [makeProgress({ wordId: 'a' })])
        await vi.advanceTimersByTimeAsync(3100)
        await first

        expect(isIndexedDbAvailable()).toBe(false)

        // No timer is advanced here: a second wait would mean it tried IndexedDB again.
        await writeMany(STORE_PROGRESS, [makeProgress({ wordId: 'b' })])
        const records = await loadProgress('mandarin')
        expect([...records.keys()].sort()).toEqual(['a', 'b'])
    })

    it('still resolves when IndexedDB is missing altogether', async () => {
        vi.stubGlobal('indexedDB', undefined)

        await writeMany(STORE_PROGRESS, [makeProgress({ wordId: 'a' })])
        expect([...(await loadProgress('mandarin')).keys()]).toEqual(['a'])
    })
})
