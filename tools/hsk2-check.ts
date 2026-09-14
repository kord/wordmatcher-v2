/**
 * Checks the hand-authored HSK 2 forms against the ChhoeTaigi extract.
 *
 *   npx tsx tools/hsk2-check.ts
 *
 * Writes a report to `%TEMP%/hsk2-check.txt` and prints only the path, because PowerShell
 * mangles CJK on the way to the console.
 *
 * For every row it reports three independent things: whether the source knows the word at all,
 * whether it agrees with my Tâi-lô spelling once tone marks are set aside, and whether it agrees
 * with my POJ. Those are separate questions - a word can be in the dictionary and still be
 * spelled differently by me, and my POJ can be wrong even when the Tâi-lô is right.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseReading } from './lib/taigiReading.ts'
import { writeReport } from './lib/tmp.ts'
import { HSK2_ROWS } from './lib/taiwaneseHsk2.ts'

interface SourceRow {
    m: string[]
    h: string[]
    tl: string
    poj: string
}

const source = JSON.parse(
    await readFile(join(process.cwd(), 'data', 'source', 'taiwanese.json'), 'utf8'),
) as { rows: SourceRow[] }

const mandarin = JSON.parse(
    await readFile(join(process.cwd(), 'public', 'data', 'lists', 'hsk2.json'), 'utf8'),
) as { entries: { simp: string; trad: string }[] }

const tradOf = new Map(mandarin.entries.map((entry) => [entry.simp, entry.trad]))

/** Spelling with tone marks removed, for comparing two renderings of the same syllables. */
function base(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u030d\u0358]/g, '')
        .replace(/--/g, '-')
        .trim()
}

/** Just the tone numbers, so the two schemes' spellings cannot hide a tone error. */
function tones(text: string, scheme: 'tailo' | 'poj'): string {
    return parseReading(text, scheme)
        .syllables.map((syllable) => syllable.tone)
        .join('-')
}

/**
 * How my reading differs from the source's, if at all.
 *
 * The two halves are reported separately because they fail differently. A spelling difference
 * is a variant or a typo; a tone difference is the same word said wrong, which is the mistake
 * this list is most likely to contain and the one a reader would not notice.
 */
function compare(mine: string, src: string, scheme: 'tailo' | 'poj'): string {
    if (src.length === 0) return '---'
    const sameSpelling = base(mine) === base(src)
    const sameTones = tones(mine, scheme) === tones(src, scheme)
    if (sameSpelling && sameTones) return 'ok'
    if (sameSpelling) return 'TONE'
    if (sameTones) return 'spell'
    return 'both'
}

function first(value: string): string {
    return (value.split('/')[0] ?? '').trim()
}

const lines: string[] = []
const problems: string[] = []

let inSource = 0
let tlOk = 0
let tlToneWrong = 0
let pojOk = 0
let pojMissing = 0

for (const [index, row] of HSK2_ROWS.entries()) {
    const [simp, han, tailo, poj, note] = row
    const trad = tradOf.get(simp) ?? simp

    const candidates = source.rows.filter(
        (entry) =>
            (han.length > 0 && entry.h.includes(han)) ||
            entry.m.includes(simp) ||
            entry.m.includes(trad),
    )

    const charHits = candidates.filter((entry) => han.length > 0 && entry.h.includes(han))
    const glossHits = candidates.filter((entry) => !charHits.includes(entry))

    // The most useful single candidate: one that shares my characters and, failing that, one
    // that shares the Mandarin gloss. Deliberately the first rather than the best-matching,
    // so a disagreement cannot be hidden by picking the row that happens to agree.
    const best = charHits[0] ?? glossHits[0]
    const bestTl = best ? first(best.tl) : ''
    const bestPoj = best ? first(best.poj) : ''

    const found = charHits.length > 0 || glossHits.length > 0
    if (found) inSource += 1

    const tlStatus = compare(tailo, bestTl, 'tailo')
    const pojStatus = compare(poj, bestPoj, 'poj')

    if (tlStatus === 'ok') tlOk += 1
    if (tlStatus === 'TONE') tlToneWrong += 1
    if (pojStatus === 'ok') pojOk += 1
    if (bestPoj.length === 0) pojMissing += 1

    const where = charHits.length > 0 ? 'characters' : glossHits.length > 0 ? 'gloss' : 'none'

    lines.push(
        [
            String(index + 1).padStart(3),
            simp.padEnd(6),
            `mine ${han || '(none)'} ${tailo} ${poj}`,
            `| src ${where.padEnd(10)}`,
            best ? `${best.h[0] ?? '(none)'} ${bestTl} ${bestPoj || '(no poj)'}` : '(nothing)',
            `| tl ${tlStatus.padEnd(5)} poj ${pojStatus}`,
        ].join('  '),
    )

    // A character can have several readings in the source. Seeing them all is what makes the
    // difference above readable: it says whether the source knows my reading at all, or only
    // a literary one, or nothing of the sort.
    if (charHits.length > 1) {
        const others = charHits
            .slice(0, 5)
            .map((entry) => first(entry.tl))
            .join(' / ')
        lines.push(`      source also reads it ${others}`)
    }

    if (note) lines.push(`      note: ${note}`)

    // The decisive question is not whether the first row agrees - for a character with several
    // readings it usually will not - but whether the source knows my reading at all. KNOWN
    // means it does and the disagreement is a matter of preference; UNKNOWN means I am asserting
    // something the dictionary does not support, and each of those needs a reason.
    if (tlStatus !== 'ok') {
        const known = charHits.some((entry) => compare(tailo, first(entry.tl), 'tailo') === 'ok')
        problems.push(
            [
                String(index + 1).padStart(3),
                simp.padEnd(6),
                known ? 'KNOWN  ' : 'UNKNOWN',
                `${han || '(no characters)'} ${tailo}`,
                tlStatus,
                note ? `— ${note}` : '',
            ].join(' '),
        )
    }
}

// Two rows that agree on both characters and reading would collide in the app, because the
// entry id is derived from exactly those two things.
const seen = new Map<string, string>()
const duplicates: string[] = []
for (const [simp, han, tailo] of HSK2_ROWS) {
    const key = `${han}|${base(tailo)}`
    const previous = seen.get(key)
    if (previous) duplicates.push(`${han} ${tailo} — ${previous} and ${simp}`)
    seen.set(key, simp)
}

const header = [
    `HSK 2 rows:            ${HSK2_ROWS.length}`,
    `found in source:       ${inSource}`,
    `Tâi-lô agrees exactly:  ${tlOk}`,
    `Tâi-lô tone differs:    ${tlToneWrong}`,
    `POJ agrees exactly:     ${pojOk}`,
    `source had no POJ:     ${pojMissing}`,
    `duplicate forms:       ${duplicates.length}`,
    '',
]
if (duplicates.length > 0) header.push('DUPLICATES', ...duplicates.map((d) => `  ${d}`), '')
if (problems.length > 0) header.push('NEEDS REVIEW', ...problems.map((p) => `  ${p}`), '')

const out = await writeReport('hsk2-check.txt', [...header, ...lines].join('\n'))
console.log(out)
