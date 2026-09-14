/**
 * Derives the actual Tai-lo <-> POJ correspondence from the source, rather than from memory.
 *
 * The two schemes are supposed to differ in a fixed set of ways, and I have been applying that
 * set by hand across 2,347 rows, which is how a column ends up half converted. This reads the
 * source rows that carry both romanisations, aligns them syllable by syllable, and reports every
 * syllable spelling that differs - so the conversion rules can be checked against the data
 * instead of asserted.
 *
 *   npx tsx tools/scheme-pairs.ts
 *
 * Writes to `tmp/scheme-pairs.txt`.
 */
import { readFileSync } from 'node:fs'
import { writeReport } from './lib/tmp.ts'

/** Tone diacritics and the dot of `o͘`, so only the letters being compared are left. */
const strip = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f\u0358]/g, '')

interface Row {
    tl?: string
    poj?: string
    h?: string
}

const parsed = JSON.parse(readFileSync('data/source/taiwanese.json', 'utf8')) as
    | Row[]
    | { rows: Row[] }
const rows = Array.isArray(parsed) ? parsed : parsed.rows

const counts = new Map<string, number>()
const examples = new Map<string, string[]>()

let aligned = 0
let unaligned = 0

for (const row of rows) {
    if (!row.tl || !row.poj) continue

    const tailo = strip(row.tl).split('-')
    const poj = strip(row.poj).split('-')

    if (tailo.length !== poj.length) {
        unaligned += 1
        continue
    }

    aligned += 1

    for (let i = 0; i < tailo.length; i += 1) {
        const from = tailo[i] ?? ''
        const to = poj[i] ?? ''
        if (from === to) continue

        const key = `${from} -> ${to}`
        counts.set(key, (counts.get(key) ?? 0) + 1)

        const seen = examples.get(key) ?? []
        if (seen.length < 3 && row.h) seen.push(`${row.h} ${row.tl}`)
        examples.set(key, seen)
    }
}

const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1])

const lines = [
    `source rows with both romanisations: ${rows.filter((r) => r.tl && r.poj).length}`,
    `aligned by syllable count: ${aligned}, skipped: ${unaligned}`,
    `distinct syllable correspondences: ${sorted.length}`,
    '',
    ...sorted.map(
        ([key, count]) =>
            `${String(count).padStart(6)}  ${key.padEnd(28)} e.g. ${(examples.get(key) ?? []).join(', ')}`,
    ),
]

const out = await writeReport('scheme-pairs.txt', lines.join('\n'))
console.log(out)
