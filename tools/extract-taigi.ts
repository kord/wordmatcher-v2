/**
 * One-off extraction of Taiwanese romanisation data from ChhoeTaigi.
 *
 * The upstream CSV is 9.8 MB and describes the whole language; we only ever look up words
 * that already appear in our own lists. Filtering it here lets the data build stay
 * self-contained and offline without vendoring the entire dictionary.
 *
 * A row is kept if EITHER side of it matches one of our words, because the two joins
 * answer different questions and we need both:
 *
 *   - matching the Mandarin column means "Taiwanese has a word for this", which is
 *     usually written with different characters (吃 -> 食)
 *   - matching the Taiwanese characters means "same word, read differently" (好 -> hó)
 *
 * Which one wins is a ranking decision made by the importer, not here, so this keeps both
 * sides intact and lets the importer change its mind without re-downloading anything.
 *
 * Both romanisations are captured. They come from parallel columns, so the two schemes are
 * the source's own spelling rather than something we converted: Tai-lo is what users in
 * Taiwan read, POJ is what most older dictionaries print, and neither is derivable from
 * the other by rule (the vowel inventories differ).
 *
 * Run: npx tsx tools/extract-taigi.ts [path-to-csv]
 *      Defaults to %TEMP%/taigi. See data/source/SOURCES.md for how to fetch the CSV.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import OpenCC from 'opencc-js'
import { parseCsv } from './lib/csv.ts'

import { hsk1Wordlist } from '../data/source/hsk1.ts'
import { hsk2Wordlist } from '../data/source/hsk2.ts'
import { hsk3Wordlist } from '../data/source/hsk3.ts'
import { hsk4Wordlist } from '../data/source/hsk4.ts'
import { hsk5Wordlist } from '../data/source/hsk5.ts'
import { hsk6Wordlist } from '../data/source/hsk6.ts'

const DEFAULT_CSV = join(tmpdir(), 'taigi', 'ChhoeTaigi_TaihoaSoanntengTuichiautian.csv')
const SOURCE_URL =
    'https://raw.githubusercontent.com/ChhoeTaigi/ChhoeTaigiDatabase/master/ChhoeTaigiDatabase/ChhoeTaigi_TaihoaSoanntengTuichiautian.csv'

const here = dirname(fileURLToPath(import.meta.url))
const outputPath = join(here, '..', 'data', 'source', 'taiwanese.json')

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' })

/** Both columns list alternatives with any of these between them. */
const SEPARATORS = /[、／/;；,，]/

interface ExtractedRow {
    /** Mandarin forms this entry glosses (`HoaBun`). */
    m: string[]
    /**
     * Taiwanese written forms (`HanLoTaibunKip`).
     *
     * Empty when the word has no settled character and is written in romanisation alone.
     */
    h: string[]
    /** Tai-lo romanisation (`KipUnicode`); may itself list variants separated by `/`. */
    tl: string
    /** POJ romanisation (`PojUnicode`). */
    poj: string
}

const HAN = /[\u3400-\u4dbf\u4e00-\u9fff]/

function split(value: string | undefined): string[] {
    return (value ?? '')
        .split(SEPARATORS)
        .map((part) => part.trim())
        .filter((part) => part.length > 0 && HAN.test(part))
}

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    const csvFlag = args.indexOf('--csv')
    const csvPath = csvFlag >= 0 ? (args[csvFlag + 1] ?? DEFAULT_CSV) : DEFAULT_CSV

    // Every form our lists can ask about, in both scripts: the source is written in
    // traditional, our lists are keyed on simplified.
    const wanted = new Set<string>()
    const sources = [hsk1Wordlist, hsk2Wordlist, hsk3Wordlist, hsk4Wordlist, hsk5Wordlist, hsk6Wordlist]
    for (const list of sources) {
        for (const [simp] of list) {
            wanted.add(simp)
            wanted.add(toTraditional(simp))
        }
    }

    const text = await readFile(csvPath, 'utf8')
    const [header, ...records] = parseCsv(text)
    if (!header) throw new Error(`${csvPath} is empty`)

    const column = (name: string): number => {
        const index = header.indexOf(name)
        if (index < 0) throw new Error(`${csvPath} has no column ${name}`)
        return index
    }

    const atMandarin = column('HoaBun')
    const atHan = column('HanLoTaibunKip')
    const atTailo = column('KipUnicode')
    const atPoj = column('PojUnicode')

    // `--raw 三 的` dumps the untouched upstream rows for those forms. This is how we tell a
    // genuine gap in the dictionary from something this filter threw away - which matters,
    // because the filter insists on Han characters and some Taiwanese headwords are written
    // in romanisation alone.
    const rawFlag = args.indexOf('--raw')
    if (rawFlag >= 0) {
        for (const word of args.slice(rawFlag + 1)) {
            console.log(`\n=== ${word}`)
            let shown = 0
            for (const record of records) {
                if (record.length !== header.length) continue
                const mandarin = split(record[atMandarin])
                const han = split(record[atHan])
                if (!mandarin.includes(word) && !han.includes(word)) continue

                shown += 1
                const tailo = (record[atTailo] ?? '').trim()
                const verdict =
                    han.length === 0
                        ? 'DROPPED: no Han headword'
                        : mandarin.length === 0
                            ? 'DROPPED: no Mandarin gloss'
                            : tailo.length === 0
                                ? 'DROPPED: no Tai-lo'
                                : 'kept'

                console.log(
                    `  ${verdict.padEnd(24)} han=${(record[atHan] ?? '').padEnd(14)} tai-lo=${tailo.padEnd(18)} mandarin=${record[atMandarin] ?? ''}`,
                )
            }
            if (shown === 0) console.log('  (no row has this form exactly)')
        }
        return
    }

    const seen = new Set<string>()
    const rows: ExtractedRow[] = []
    let scanned = 0
    let dropped = 0

    for (const record of records) {
        if (record.length !== header.length) continue
        scanned += 1

        const m = split(record[atMandarin])
        const h = split(record[atHan])
        const tl = (record[atTailo] ?? '').trim()
        const poj = (record[atPoj] ?? '').trim()

        // A Taiwanese word does not always have a settled character: the colloquial negator
        // 不 is written `m̄`, and 的 is written `ê`, with the romanisation sitting in the
        // character column. Requiring Han here discards exactly the words a learner most
        // needs, so keep the row with an empty `h` and let the app show the romanisation as
        // the headword.
        if (tl.length === 0 || (m.length === 0 && h.length === 0)) {
            dropped += 1
            continue
        }

        const touchesMandarin = m.some((form) => wanted.has(form))
        const touchesCharacters = h.some((form) => wanted.has(form))
        if (!touchesMandarin && !touchesCharacters) continue

        const row: ExtractedRow = { m, h, tl, poj }
        const fingerprint = createHash('sha1').update(JSON.stringify(row)).digest('hex')
        if (seen.has(fingerprint)) continue
        seen.add(fingerprint)
        rows.push(row)
    }

    const payload = {
        source: {
            name: 'Tai-hoa Soan-teng Tui-chiau-tian (臺華雙語辭典)',
            collection: 'ChhoeTaigi',
            url: SOURCE_URL,
            licence: 'CC BY-SA 4.0',
        },
        rows,
    }

    const json = JSON.stringify(payload)
    await writeFile(outputPath, json, 'utf8')

    console.log(`scanned        ${scanned} rows`)
    console.log(`unusable       ${dropped} (no Tai-lo, or neither a gloss nor a headword)`)
    console.log(`matched        ${rows.length} distinct rows`)
    console.log(`written        ${outputPath}`)
    console.log(`size           ${(Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)} KB`)

    const distinctMandarin = new Set(rows.flatMap((row) => row.m)).size
    const distinctHan = new Set(rows.flatMap((row) => row.h)).size
    console.log(`distinct Mandarin forms ${distinctMandarin}, Taiwanese forms ${distinctHan}`)
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
