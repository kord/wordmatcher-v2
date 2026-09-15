/**
 * Second opinion on the Taiwanese readings, from a source built independently of ours.
 *
 * Every row in `tools/lib/taiwaneseHsk*.ts` was written for the word, and the only thing it has
 * ever been checked against is the ChhoeTaigi extract - which means a reading the extract does
 * not know about, or a reading both we and it reached by the same character-match instinct, goes
 * unchallenged. This compares the same rows against Luo Jia-peng's 華語臺語 correspondence tables
 * (see `data/source/SOURCES.md`, "Other Taiwanese corpora surveyed"), which are character-keyed
 * rather than word-keyed, and which - unlike ours - record *which* reading of a character is the
 * spoken one.
 *
 *   npx tsx tools/hantai-check.ts [--level 5] [--reference tmp/refs/hantai-characters.tsv]
 *
 * The reference reports, for every character it knows, each Taiwanese reading of it, with 文
 * (literary) or 俗/白 (colloquial) where the two differ. Two things follow, and they are the two
 * things we actually want to know:
 *
 *   1. whether our reading is attested for that character at all, and
 *   2. whether we used the literary reading of a character whose spoken reading is something
 *      else - the failure this project exists to avoid, because a literary reading is a real
 *      reading, so it looks correct to anyone who does not already say the word out loud.
 *
 * A disagreement on its own proves nothing, since two dictionaries disagreeing only means one of
 * them is wrong. So each flagged syllable also gets the extract's position on it, which is what
 * makes the report actionable:
 *
 *   theirs   the extract does not have our reading but does have the reference's - both sources
 *            against us. These are the ones worth opening first.
 *   ours     the extract has our reading too, so the two sources disagree and we follow ours.
 *   neither  the extract knows the character but gives neither reading.
 *   silent   the extract has no reading for the character at all; unverifiable.
 *
 * It is a prompt for review, never an automatic correction. The reference has its own noise - it
 * gives `肉` a colloquial reading of `hik8`, which is not a thing - and a literary reading is the
 * right one in plenty of formal compounds. Nothing here rewrites a table.
 *
 * The reference is not vendored. Regenerate the TSV with `tools/xls-to-tsv.py` after downloading
 * `k_t_duiing.xls` and `t_wenbai.xls`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeReport } from './lib/tmp.ts'
import { parseReading } from './lib/taigiReading.ts'
import type { Romanization } from '../src/domain/types.ts'

interface Entry {
    simp: string
    trad: string
    romanizations: { tailo?: Romanization }
}

interface SourceRow {
    m?: string
    h?: string
    tl?: string
    poj?: string
}

const args = process.argv.slice(2)
const levelFlag = args.indexOf('--level')
const level = levelFlag >= 0 ? Number(args[levelFlag + 1]) : 5
const referenceFlag = args.indexOf('--reference')
const referencePath =
    referenceFlag >= 0
        ? args[referenceFlag + 1]
        : join(process.cwd(), 'tmp', 'refs', 'hantai-characters.tsv')

function add(map: Map<string, Set<string>>, key: string, value: string): void {
    const set = map.get(key) ?? new Set<string>()
    set.add(value)
    map.set(key, set)
}

/** character -> every reading the tables record, and which of them they call colloquial. */
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

/**
 * The extract's own character-keyed readings, built the same way: align the characters of a
 * headword with the syllables of its Tai-lo and record each pair.
 */
function loadExtract(): Map<string, Set<string>> {
    const readings = new Map<string, Set<string>>()
    const parsed = JSON.parse(
        readFileSync(join(process.cwd(), 'data', 'source', 'taiwanese.json'), 'utf8'),
    ) as { rows: SourceRow[] }

    for (const row of parsed.rows) {
        if (!row.h || !row.tl) continue
        const characters = Array.from(row.h)
        const syllables = parseReading(row.tl, 'tailo').syllables
        if (characters.length !== syllables.length) continue
        for (let index = 0; index < characters.length; index += 1) {
            const syllable = syllables[index]
            if (!syllable) continue
            add(readings, characters[index] ?? '', `${syllable.base}${syllable.tone}`)
        }
    }

    return readings
}

/** The letters of a numbered syllable, so a tone difference can be told from a wrong reading. */
const letters = (syllable: string) => syllable.replace(/[0-9]+$/, '').toLowerCase()

/**
 * Readings are compared without case. Proper nouns are capitalised in the Tai-lo our tables carry
 * - `Tn̂g-siânn` for the Great Wall - so comparing raw text reports every capitalised syllable as
 * unattested.
 */
const key = (syllable: string) => syllable.toLowerCase()

const reference = loadReference(referencePath)
const extract = loadExtract()
const listPath = join(process.cwd(), 'public', 'data', 'lists', `hsk${level}-tw.json`)
const entries = (JSON.parse(readFileSync(listPath, 'utf8')) as { entries: Entry[] }).entries

const theirs: string[] = []
const ours: string[] = []
const neither: string[] = []
const silent: string[] = []
const toneOnly: string[] = []
const literary: string[] = []
let aligned = 0
let skipped = 0
let syllables = 0
let known = 0

for (const entry of entries) {
    const numbered = entry.romanizations.tailo?.numbered
    if (!numbered) continue

    const characters = Array.from(entry.trad)
    const parts = numbered.split('-')
    if (characters.length !== parts.length) {
        skipped += 1
        continue
    }

    aligned += 1
    const label = `${entry.simp} ${entry.trad} ${numbered}`

    for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index] ?? ''
        const syllable = parts[index]
        if (!syllable) continue
        syllables += 1

        const knownReadings = reference.readings.get(character)
        if (!knownReadings) continue
        known += 1
        const knownLower = [...knownReadings].map(key)
        const written = key(syllable)

        if (knownLower.includes(written)) {
            const colloquial = reference.colloquial.get(character)
            const colloquialLower = [...(colloquial ?? [])].map(key)
            if (colloquialLower.length > 0 && !colloquialLower.includes(written)) {
                literary.push(
                    `  ${label}  — ${character} ${syllable}; colloquial here is ${[...(colloquial ?? [])].join(' ')}`,
                )
            }
            continue
        }

        const mine = new Set([...(extract.get(character) ?? [])].map(key))
        const sameLetters = knownLower.filter((r) => letters(r) === letters(syllable))
        const detail = `  ${label}  — ${character} ${syllable}; tables ${[...knownReadings].join(' ')}; extract ${[...(extract.get(character) ?? [])].join(' ') || '—'}`

        if (sameLetters.length > 0) toneOnly.push(detail)
        else if (mine.has(written)) ours.push(detail)
        else if (mine.size === 0) silent.push(detail)
        else if (knownLower.some((r) => mine.has(r))) theirs.push(detail)
        else neither.push(detail)
    }
}

const section = (title: string, lines: string[]) => [`${title} (${lines.length})`, ...lines, '']

const literaryShare = known > 0 ? Math.round((literary.length / known) * 100) : 0

const out = await writeReport(
    `hantai-check-${level}.txt`,
    [
        `reference: ${referencePath}`,
        `characters with readings: ${reference.readings.size}; extract characters: ${extract.size}`,
        '',
        `HSK ${level} entries: ${entries.length}`,
        `  aligned character to syllable: ${aligned}`,
        `  skipped, counts differ: ${skipped}`,
        `  syllables compared: ${syllables}, of which the tables know the character: ${known}`,
        '',
        ...section('BOTH SOURCES AGAINST US — worth opening first', theirs),
        ...section('SOURCES DISAGREE, EXTRACT BACKS US', ours),
        ...section('SAME LETTERS, DIFFERENT TONE', toneOnly),
        ...section('EXTRACT KNOWS THE CHARACTER BUT GIVES NEITHER READING', neither),
        ...section('EXTRACT HAS NO READING FOR THE CHARACTER', silent),
        '',
        `LITERARY READING WHERE THE TABLES ALSO RECORD A SPOKEN ONE (${literary.length}, ${literaryShare}% of compared syllables)`,
        '  Read this as a description, not a defect list. A 文讀 is the correct reading inside a',
        '  formal compound — 安慰 is an-ui, not uann-ui, and 安裝 is an-tsong, not an-tsng — so a',
        '  third of the corpus landing here is the normal situation rather than a third of it being',
        '  wrong. Investigate an entry only when the word itself is everyday speech.',
        ...literary,
    ].join('\n'),
)
console.log(out)
