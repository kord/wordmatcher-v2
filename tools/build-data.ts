/**
 * Build-time content pipeline.
 *
 * Reads the read-only upstream word lists in `data/source`, derives pinyin and traditional
 * forms, resolves the Taiwanese equivalents of the HSK vocabulary, and emits one JSON file
 * per playable list into `public/data/lists`, plus a manifest the app fetches on boot.
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
    Language,
    ListManifest,
    ListManifestEntry,
    WordEntry,
    WordListFile,
} from '../src/domain/types.ts'
import { parseGloss } from './lib/gloss.ts'
import { glossOverrideFor, unusedGlossOverrides } from './lib/glossOverrides.ts'
import { buildPinyin } from './lib/pinyin.ts'
import { pinyinOverrideFor, unusedPinyinOverrides } from './lib/pinyinOverrides.ts'
import { parseReading } from './lib/taigiReading.ts'
import type { TaiwaneseIndex } from './lib/taiwanese.ts'
import { indexTaiwanese, loadTaiwaneseSource, rankCandidates } from './lib/taiwanese.ts'
import { unusedTaiwaneseOverrides } from './lib/taiwaneseOverrides.ts'

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

/**
 * Stable id, so progress survives list regeneration and list membership changes.
 *
 * The id is also what keeps progress apart between varieties, so a Taiwanese entry is
 * namespaced. Mandarin ids are deliberately left byte-identical to what they have always
 * been, so an existing learner's records still resolve.
 */
function entryId(form: string, marked: string, language: Language = 'mandarin'): string {
    const prefix = language === 'mandarin' ? '' : `${language}|`
    return createHash('sha1').update(`${prefix}${form}|${marked}`).digest('hex').slice(0, 12)
}

interface BuildEntryOptions {
    listId: string
    hsk?: HskLevel
    rank?: number
}

function buildEntry(pair: WordPairs[number], options: BuildEntryOptions): WordEntry {
    const [simp, gloss] = pair
    // The reading is corrected first, because the gloss overrides are keyed on the numbered
    // reading: correcting 了 from liao3 to le0 would otherwise leave its gloss override
    // pointing at a key that no longer exists.
    const pinyin = pinyinOverrideFor(options.listId, simp) ?? buildPinyin(simp)
    const parsed = parseGloss(gloss)

    // A hand correction wins over the upstream text. The id stays keyed on the
    // character and its reading rather than the gloss, so rewording a definition
    // never disturbs a player's saved progress.
    const corrected = glossOverrideFor(options.listId, simp, pinyin.numbered)
    const glosses = corrected ? [...corrected] : parsed.glosses

    const entry: WordEntry = {
        id: entryId(simp, pinyin.marked),
        language: 'mandarin',
        simp,
        trad: toTraditional(simp),
        romanizations: { pinyin },
        glosses,
        glossShort: glosses[0] ?? parsed.glossShort,
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
        language: 'mandarin',
        ...extra,
    }
}

/**
 * Build one HSK level of Taiwanese entries.
 *
 * Each entry is a Taiwanese word rather than a re-reading of a Mandarin one, which is the
 * whole point: where Taiwanese says something else the characters change too (吃 -> 食), and
 * where it does not only the reading does (好 -> hó). The Mandarin word it answers for rides
 * along so the reveal and the mistake review can show the pair and say which kind of
 * difference it is.
 *
 * A word the resolver cannot place is dropped rather than guessed at. Silently inventing a
 * form would be worse than a shorter list, because the whole value of this list is that
 * someone checked it.
 */
function buildTaiwaneseEntries(
    mandarinEntries: readonly WordEntry[],
    index: TaiwaneseIndex,
    listId: string,
): WordEntry[] {
    const entries: WordEntry[] = []

    for (const mandarin of mandarinEntries) {
        // Keyed on the Mandarin list, because that is what the overrides are keyed on.
        const ranked = rankCandidates(index, mandarin.simp, mandarin.trad, mandarin.listId)
        const row = ranked.best?.row
        const pinyin = mandarin.romanizations.pinyin
        if (!row || !pinyin) continue

        // A row may list several acceptable pronunciations; the first is the source's own
        // preference. An empty POJ field is common and simply means we have one scheme.
        const tailo = (row.tl.split('/')[0] ?? '').trim()
        const poj = (row.poj.split('/')[0] ?? '').trim()
        if (tailo.length === 0) continue

        // Empty when the word has no settled character, which is common: 不 is written `m̄`
        // and 的 is written `ê`. The app falls back to the romanisation for those.
        const han = row.h[0] ?? ''

        const romanizations: WordEntry['romanizations'] = { tailo: parseReading(tailo, 'tailo') }
        if (poj.length > 0) romanizations.poj = parseReading(poj, 'poj')

        const entry: WordEntry = {
            id: entryId(han, tailo, 'taiwanese'),
            language: 'taiwanese',
            simp: han,
            trad: han,
            romanizations,
            glosses: mandarin.glosses,
            glossShort: mandarin.glossShort,
            // Classifiers are a Mandarin property of the word. Showing them beside a
            // Taiwanese entry would assert a pairing nobody has checked.
            classifiers: [],
            listId,
            mandarin: {
                simp: mandarin.simp,
                trad: mandarin.trad,
                glossShort: mandarin.glossShort,
                pinyin,
                differs: han.length > 0 && han === mandarin.trad ? 'reading' : 'word',
                ...(ranked.overridden ? { note: ranked.reason } : {}),
            },
        }

        if (mandarin.hsk !== undefined) entry.hsk = mandarin.hsk
        entries.push(entry)
    }

    return entries
}

async function main(): Promise<void> {
    await mkdir(outputDir, { recursive: true })

    const lists: ListManifestEntry[] = []
    const mandarinByLevel = new Map<HskLevel, WordEntry[]>()

    for (const level of [1, 2, 3, 4, 5, 6] as HskLevel[]) {
        const entries = buildEntries(HSK_SOURCE[level], () => ({
            listId: `hsk${level}`,
            hsk: level,
        }))
        mandarinByLevel.set(level, entries)

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

    // Taiwanese lists mirror the Mandarin ones by HSK level. Each level is curated by hand
    // rather than joined mechanically, so a level is added here once its forms have been
    // chosen and checked against the source. HSK 1 and HSK 2 so far.
    const taiwanese = await loadTaiwaneseSource()
    const taiwaneseIndex = indexTaiwanese(taiwanese.rows)

    for (const level of [1, 2] as HskLevel[]) {
        const entries = buildTaiwaneseEntries(
            mandarinByLevel.get(level) ?? [],
            taiwaneseIndex,
            `hsk${level}-tw`,
        )

        lists.push(
            await writeList(
                { id: `hsk${level}-tw`, name: `HSK ${level} (Taiwanese)`, entries },
                `${entries.length} words`,
                { level, language: 'taiwanese' },
            ),
        )
    }

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

    // An override whose key no longer matches anything is a silent regression: the
    // correction is gone but the build still succeeds. Fail instead.
    const orphaned = unusedGlossOverrides()
    if (orphaned.length > 0) {
        console.warn(`\n${orphaned.length} gloss override(s) matched no entry:`)
        for (const key of orphaned) console.warn(`  ${key}`)
        console.warn('Check the spelling of the key, and that the reading has not changed upstream.')
        process.exitCode = 1
    }

    const orphanedTaiwanese = unusedTaiwaneseOverrides()
    if (orphanedTaiwanese.length > 0) {
        console.warn(`\n${orphanedTaiwanese.length} Taiwanese override(s) matched no entry:`)
        for (const key of orphanedTaiwanese) console.warn(`  ${key}`)
        console.warn('Check the spelling of the key, and that the word is in a list being built.')
        process.exitCode = 1
    }

    const orphanedPinyin = unusedPinyinOverrides()
    if (orphanedPinyin.length > 0) {
        console.warn(`\n${orphanedPinyin.length} pinyin override(s) matched no entry:`)
        for (const key of orphanedPinyin) console.warn(`  ${key}`)
        console.warn('Check the spelling of the key, and that the character is in a list being built.')
        process.exitCode = 1
    }
}

main().catch((error: unknown) => {
    console.error('Data build failed:')
    console.error(error)
    process.exitCode = 1
})
