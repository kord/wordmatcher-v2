/**
 * Build-time content pipeline.
 *
 * Reads the read-only upstream word lists in `data/source`, derives pinyin and
 * Taiwanese traditional forms, and emits one JSON file per playable list into
 * `public/data/lists`, plus a manifest the app fetches on boot.
 *
 * Run with `npm run data:build`.
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenCC from 'opencc-js'
import type {
    HskLevel,
    ListManifest,
    ListManifestEntry,
    WordEntry,
    WordListFile,
} from '../src/domain/types.ts'
import { parseGloss } from './lib/gloss.ts'
import { buildPinyin } from './lib/pinyin.ts'

import { hsk1Wordlist } from '../data/source/hsk1.ts'
import { hsk2Wordlist } from '../data/source/hsk2.ts'
import { hsk3Wordlist } from '../data/source/hsk3.ts'
import { hsk4Wordlist } from '../data/source/hsk4.ts'
import { hsk5Wordlist } from '../data/source/hsk5.ts'
import { hsk6Wordlist } from '../data/source/hsk6.ts'
import { junDaWordlist } from '../data/source/junDa.ts'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')
const outputDir = join(projectRoot, 'public', 'data', 'lists')

const MANIFEST_VERSION = 1

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' })

type WordPairs = [string, string][]

const HSK_SOURCE: Record<HskLevel, WordPairs> = {
    1: hsk1Wordlist,
    2: hsk2Wordlist,
    3: hsk3Wordlist,
    4: hsk4Wordlist,
    5: hsk5Wordlist,
    6: hsk6Wordlist,
}

/** Stable id, so progress survives list regeneration and list membership changes. */
function entryId(simp: string, marked: string): string {
    return createHash('sha1').update(`${simp}|${marked}`).digest('hex').slice(0, 12)
}

interface BuildEntryOptions {
    listId: string
    hsk?: HskLevel
    rank?: number
}

function buildEntry(pair: WordPairs[number], options: BuildEntryOptions): WordEntry {
    const [simp, gloss] = pair
    const pinyin = buildPinyin(simp)
    const parsed = parseGloss(gloss)

    const entry: WordEntry = {
        id: entryId(simp, pinyin.marked),
        simp,
        trad: toTraditional(simp),
        pinyin,
        glosses: parsed.glosses,
        glossShort: parsed.glossShort,
        classifiers: parsed.classifiers,
        listId: options.listId,
    }

    if (options.hsk !== undefined) entry.hsk = options.hsk
    if (options.rank !== undefined) entry.rank = options.rank

    return entry
}

/** Deduplicate by simplified form; the first occurrence wins. */
function buildEntries(
    pairs: WordPairs,
    optionsForIndex: (index: number) => BuildEntryOptions,
): WordEntry[] {
    const seen = new Set<string>()
    const entries: WordEntry[] = []

    pairs.forEach((pair, index) => {
        const simp = pair[0]
        if (seen.has(simp)) return
        seen.add(simp)
        entries.push(buildEntry(pair, optionsForIndex(index)))
    })

    return entries
}

async function writeList(file: WordListFile, subtitle: string, extra: Partial<ListManifestEntry>): Promise<ListManifestEntry> {
    const payload = JSON.stringify(file)
    await writeFile(join(outputDir, `${file.id}.json`), payload, 'utf8')

    return {
        id: file.id,
        name: file.name,
        subtitle,
        count: file.entries.length,
        file: `${file.id}.json`,
        bytes: Buffer.byteLength(payload, 'utf8'),
        kind: file.id === 'junda' ? 'junda' : 'hsk',
        ...extra,
    }
}

async function main(): Promise<void> {
    await mkdir(outputDir, { recursive: true })

    const lists: ListManifestEntry[] = []

    for (const level of [1, 2, 3, 4, 5, 6] as HskLevel[]) {
        const entries = buildEntries(HSK_SOURCE[level], () => ({
            listId: `hsk${level}`,
            hsk: level,
        }))

        lists.push(
            await writeList(
                { id: `hsk${level}`, name: `HSK ${level}`, entries },
                `${entries.length} words`,
                { level },
            ),
        )
    }

    const junDaEntries = buildEntries(junDaWordlist, (index) => ({
        listId: 'junda',
        rank: index + 1,
    }))

    lists.push(
        await writeList(
            { id: 'junda', name: 'Jun Da', entries: junDaEntries },
            `Top ${junDaEntries.length} characters by frequency`,
            {},
        ),
    )

    const manifest: ListManifest = {
        version: MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        lists,
    }
    await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

    let totalBytes = 0
    let totalEntries = 0
    console.log('Generated word lists:')
    for (const list of lists) {
        totalBytes += list.bytes
        totalEntries += list.count
        console.log(
            `  ${list.id.padEnd(7)} ${String(list.count).padStart(5)} entries  ${(list.bytes / 1024).toFixed(1).padStart(7)} KB`,
        )
    }
    console.log(
        `  ${'total'.padEnd(7)} ${String(totalEntries).padStart(5)} entries  ${(totalBytes / 1024).toFixed(1).padStart(7)} KB`,
    )
    console.log('\nManifest written to public/data/lists/manifest.json')
}

main().catch((error: unknown) => {
    console.error('Data build failed:')
    console.error(error)
    process.exitCode = 1
})
