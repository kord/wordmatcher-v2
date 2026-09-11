import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListManifest, WordEntry, WordListFile } from '../../src/domain/types'
import { listIdsFor, resolvePool } from '../../src/content/wordPool'
import { makeEntry } from './fixtures'

const hoisted = vi.hoisted(() => ({
    files: new Map<string, WordListFile>(),
}))

vi.mock('../../src/content/listLoader', () => ({
    loadList: (id: string) => {
        const file = hoisted.files.get(id)
        return file ? Promise.resolve(file) : Promise.reject(new Error(`missing list ${id}`))
    },
}))

function listOf(id: string, name: string, entries: WordEntry[]): WordListFile {
    return { id, name, entries }
}

const MANIFEST: ListManifest = {
    version: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    lists: [
        { id: 'hsk1', name: 'HSK 1', subtitle: '', count: 2, file: 'hsk1.json', bytes: 0, kind: 'hsk', level: 1 },
        { id: 'hsk2', name: 'HSK 2', subtitle: '', count: 2, file: 'hsk2.json', bytes: 0, kind: 'hsk', level: 2 },
        { id: 'junda', name: 'Jun Da', subtitle: '', count: 4, file: 'junda.json', bytes: 0, kind: 'junda' },
    ],
}

beforeEach(() => {
    hoisted.files.clear()
    hoisted.files.set(
        'hsk1',
        listOf('hsk1', 'HSK 1', [
            makeEntry({ simp: '爱', id: 'ai', hsk: 1 }),
            makeEntry({ simp: '我', id: 'wo', hsk: 1 }),
        ]),
    )
    hoisted.files.set(
        'hsk2',
        listOf('hsk2', 'HSK 2', [
            // Deliberately shares an id with hsk1 to prove de-duplication works.
            makeEntry({ simp: '爱', id: 'ai', hsk: 2 }),
            makeEntry({ simp: '想', id: 'xiang', hsk: 2 }),
        ]),
    )
    hoisted.files.set(
        'junda',
        listOf('junda', 'Jun Da', [
            makeEntry({ simp: '的', id: 'de', rank: 1 }),
            makeEntry({ simp: '一', id: 'yi', rank: 2 }),
            makeEntry({ simp: '是', id: 'shi', rank: 3 }),
            makeEntry({ simp: '不', id: 'bu', rank: 4 }),
        ]),
    )
})

describe('listIdsFor', () => {
    it('loads a single HSK level by default', () => {
        expect(listIdsFor({ kind: 'hsk', level: 3, includeLower: false })).toEqual(['hsk3'])
    })

    it('includes lower levels when asked, in ascending order', () => {
        expect(listIdsFor({ kind: 'hsk', level: 3, includeLower: true })).toEqual([
            'hsk1',
            'hsk2',
            'hsk3',
        ])
    })

    it('loads the Jun Da list for a rank selection', () => {
        expect(listIdsFor({ kind: 'junda', maxRank: 500 })).toEqual(['junda'])
    })
})

describe('resolvePool', () => {
    it('returns one HSK level with its display name', async () => {
        const pool = await resolvePool({ kind: 'hsk', level: 1, includeLower: false }, MANIFEST)

        expect(pool.entries.map((entry) => entry.id)).toEqual(['ai', 'wo'])
        expect(pool.listNames).toEqual(['HSK 1'])
    })

    it('merges levels and de-duplicates words that appear in more than one', async () => {
        const pool = await resolvePool({ kind: 'hsk', level: 2, includeLower: true }, MANIFEST)

        expect(pool.entries.map((entry) => entry.id)).toEqual(['ai', 'wo', 'xiang'])
        expect(pool.listNames).toEqual(['HSK 1', 'HSK 2'])
    })

    it('keeps the first occurrence when de-duplicating', async () => {
        const pool = await resolvePool({ kind: 'hsk', level: 2, includeLower: true }, MANIFEST)
        expect(pool.entries.find((entry) => entry.id === 'ai')?.hsk).toBe(1)
    })

    it('filters Jun Da entries by rank', async () => {
        const pool = await resolvePool({ kind: 'junda', maxRank: 2 }, MANIFEST)

        expect(pool.entries.map((entry) => entry.id)).toEqual(['de', 'yi'])
        expect(pool.listNames).toEqual(['Jun Da'])
    })

    it('surfaces a clear error when a list file is missing', async () => {
        await expect(
            resolvePool({ kind: 'hsk', level: 6, includeLower: false }, MANIFEST),
        ).rejects.toThrow(/missing list hsk6/)
    })
})
