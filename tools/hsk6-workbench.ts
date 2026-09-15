/**
 * The authoring workbench for HSK 6 Taiwanese.
 *
 * For every word in the level it puts three things on one line: what the ranking in
 * `./lib/taiwanese.ts` proposes and how sure it is, every reading the independent reference
 * dictionary records for each character of the word (marking the ones it calls spoken), and
 * whether the proposal keeps the characters or swaps the word. A row gets written from the
 * pair of them, because neither is sufficient alone: the ranking guesses which word is meant
 * but cannot tell a real equivalent from an idiom that merely glosses the same, and the
 * reference knows readings but cannot see where a word ends.
 *
 * Words needing judgement come first - no candidate, then character swaps, then the rows that
 * only need a reading - which is how the batches get planned. The reading-only group is by far
 * the largest: on HSK 5 it was 1188 of 1300.
 *
 * Run: npx tsx tools/hsk6-workbench.ts
 *
 * Written with `writeReport` rather than printed, because PowerShell 5.1 decodes a native
 * command's stdout with the OEM codepage and turns every Chinese character into mojibake.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import OpenCC from 'opencc-js'
import { hsk6Wordlist } from '../data/source/hsk6.ts'
import { writeReport } from './lib/tmp.ts'
import { indexTaiwanese, loadTaiwaneseSource, rankCandidates } from './lib/taiwanese.ts'

const referencePath = join(process.cwd(), 'tmp', 'refs', 'hantai-characters.tsv')

function add(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key) ?? new Set<string>()
    set.add(value)
    map.set(key, set)
}

/**
 * character -> every reading the tables record, and which of them they call spoken.
 *
 * Duplicated from `hantai-check.ts` rather than shared, so that a change here cannot disturb
 * the checker that audits the built lists.
 */
function loadReference(path: string) {
    const readings = new Map<string, Set<string>>()
    const colloquial = new Map<string, Set<string>>()

    let text: string
    try {
        text = readFileSync(path, 'utf8')
    } catch {
        throw new Error(
            `No reference at ${path}.\n` +
                'Download 駱嘉鵬\'s correspondence tables from\n' +
                '  https://github.com/Taiwanese-Corpus/Loh8_2004_hanyu-document\n' +
                'then run:  python tools/xls-to-tsv.py <the directory holding the .xls files>',
        )
    }

    for (const line of text.split('\n').slice(1)) {
        if (!line) continue
        const kind = line.slice(0, line.indexOf('\t'))
        const fields = line.split('\t')
        const character = fields[1] ?? ''
        if (!character) continue

        if (kind === 'char') {
            // character, Mandarin reading, register (文/俗/白 or empty), Taiwanese reading.
            const register = fields[3] ?? ''
            const taiwanese = fields[4] ?? ''
            if (!taiwanese) continue
            add(readings, character, taiwanese)
            if (register === '俗' || register === '白') add(colloquial, character, taiwanese)
        }

        if (kind === 'wenbai') {
            // character, literary reading, spoken reading.
            const literary = fields[2] ?? ''
            const spoken = fields[3] ?? ''
            if (!literary || !spoken) continue
            add(readings, character, literary)
            add(readings, character, spoken)
            add(colloquial, character, spoken)
        }
    }

    return { readings, colloquial }
}

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' })

const source = await loadTaiwaneseSource()
const index = indexTaiwanese(source.rows)
const reference = loadReference(referencePath)

/** What the reference says about every character of a word, `?` where it is silent. */
function readingsFor(word: string): string {
    return [...word]
        .map((character) => {
            const known = reference.readings.get(character)
            if (!known) return `${character}=?`
            const spoken = reference.colloquial.get(character)
            const marked = [...known]
                .map((reading) => (spoken?.has(reading) ? `${reading}(白)` : reading))
                .join('/')
            return `${character}=${marked}`
        })
        .join(' ')
}

interface Reviewed {
    /** `0007 癌症` - the word's position in the level, which is how the batches are cut. */
    order: string
    detail: string
}

const body: string[] = []
const none: string[] = []
const swaps: string[] = []
const readingsOnly: string[] = []

const tally = { override: 0, high: 0, medium: 0, low: 0, none: 0 }

/** Every row that could describe a word, so a judgement call has the evidence on the page. */
function candidatesOf(ranked: ReturnType<typeof rankCandidates>): string {
    const describe = (candidate: (typeof ranked.alternatives)[number], marker: string): string => {
        const row = candidate.row
        return `      ${marker} ${(row.h[0] ?? '—').padEnd(7)} ${row.tl.padEnd(18)} poj=${(row.poj || '—').padEnd(18)} via ${candidate.via.padEnd(9)} means: ${row.m.join(', ')}`
    }
    return [describe(ranked.best!, '>'), ...ranked.alternatives.map((a) => describe(a, ' '))].join(
        '\n',
    )
}

hsk6Wordlist.forEach(([simp, gloss], i) => {
    const trad = toTraditional(simp)
    const ranked = rankCandidates(index, simp, trad, 'hsk6')
    const number = String(i + 1).padStart(4, '0')
    const order = `${number} ${trad}`
    tally[ranked.confidence] += 1

    if (!ranked.best) {
        none.push(`${order}  ${gloss}\n      ref ${readingsFor(trad)}\n      (no rows at all)`)
        body.push(`${order}\n      no candidate in the source\n      ref ${readingsFor(trad)}`)
        return
    }

    const row = ranked.best.row
    const han = row.h[0] ?? ''
    const proposed = `${(han || '—').padEnd(6)} ${row.tl}`
    // The gloss rides along because it is what decides a character swap: the ranking sees the
    // Mandarin word, and only a person can say whether the proposed word means the same thing.
    body.push(
        [
            `${order}  ${gloss}`,
            `      ${ranked.confidence.padEnd(8)}${ranked.overridden ? '*' : ' '} ${proposed.padEnd(22)} poj=${(row.poj || '—').padEnd(18)} alt:${String(ranked.alternatives.length).padStart(2)}`,
            `      ref ${readingsFor(trad)}`,
        ].join('\n'),
    )

    // A proposal that keeps the characters is a reading to get right; one that changes them is
    // the judgement call, because it claims this is the word people actually say. Only the
    // judgement calls need the alternatives listed - a reading can be settled from the reference.
    if (han.length > 0 && han !== trad) {
        swaps.push(
            `${order}  ${gloss}\n      ranking: ${ranked.confidence}  ${ranked.reason}\n      ref ${readingsFor(trad)}\n${candidatesOf(ranked)}`,
        )
    } else {
        readingsOnly.push(order)
    }
})

const index_ = (title: string, rows: string[]): string =>
    `\n=== ${title} (${rows.length}) ===\n${rows.join('\n')}`

const text = [
    `HSK 6 Taiwanese authoring workbench`,
    `reference: ${referencePath} (${reference.readings.size} characters with readings)`,
    `words: ${hsk6Wordlist.length}`,
    `ranking: corrected ${tally.override}  high ${tally.high}  medium ${tally.medium}  low ${tally.low}  none ${tally.none}`,
    `split: no candidate ${none.length}  character swap ${swaps.length}  reading only ${readingsOnly.length}`,
    index_('NO CANDIDATE - must be authored from scratch', none),
    index_(
        'CHARACTER SWAP - the ranking claims a different word is said, every candidate listed',
        swaps,
    ),
    `\n=== READING ONLY (${readingsOnly.length}) - same characters, so the reading settles it; audit with hantai-check once built ===\n${readingsOnly.join('\n')}`,
    `\n\n========== EVERY WORD IN LIST ORDER, 250 AT A TIME ==========\n`,
    ...body,
].join('\n')

const path = await writeReport('hsk6-candidates.txt', text)
console.log(`wrote ${path}`)
console.log(
    `split: no candidate ${none.length}  character swap ${swaps.length}  reading only ${readingsOnly.length}  (of ${hsk6Wordlist.length})`,
)
