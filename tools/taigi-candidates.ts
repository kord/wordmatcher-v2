/**
 * Dump the Taiwanese candidates for one or more words.
 *
 * This is the review tool for the ranking: it shows every row that could describe a word,
 * which side it was found from, and what else the dictionary says that headword means.
 * Ranking heuristics get tuned here and the results get eyeballed, because there is no
 * automatic way to tell a real equivalent (吃 -> 食) from an idiom that merely glosses to
 * the same Mandarin word (吃 -> 祭孤).
 *
 * Run: npx tsx tools/taigi-candidates.ts 吃 不 都 三
 *      npx tsx tools/taigi-candidates.ts --hsk1 --out report.txt
 *
 * Write to a file instead of piping to the console: PowerShell 5.1 decodes a native
 * command's output with the OEM codepage, which turns every Chinese character into
 * mojibake and makes the report useless for the one job it has.
 */
import { writeFile } from 'node:fs/promises'
import OpenCC from 'opencc-js'
import { hsk1Wordlist } from '../data/source/hsk1.ts'
import type { Candidate } from './lib/taiwanese.ts'
import { indexTaiwanese, loadTaiwaneseSource, rankCandidates } from './lib/taiwanese.ts'
import { unusedTaiwaneseOverrides } from './lib/taiwaneseOverrides.ts'

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' })

const args = process.argv.slice(2)

// `--out <path>` takes a value, so that value must not be mistaken for a word to look up.
const outFlag = args.indexOf('--out')
const outPath = outFlag >= 0 ? args[outFlag + 1] : undefined
if (outFlag >= 0 && !outPath) throw new Error('--out needs a path')

const allHsk1 = args.includes('--hsk1')

// Overrides are keyed by list, so looking a word up needs to know which one to consult.
// It defaults to hsk1 because that is the only list curated so far.
const listFlag = args.indexOf('--list')
const listId = listFlag >= 0 ? (args[listFlag + 1] ?? 'hsk1') : 'hsk1'

// A flag's value must not be mistaken for a word to look up. `flag + 1` is 0 when the flag
// is absent, which would drop the first word, so only skip when the flag is really there.
const valueIndexes = new Set([outFlag, listFlag].filter((at) => at >= 0).map((at) => at + 1))
const words = args.filter((arg, index) => !arg.startsWith('--') && !valueIndexes.has(index))

const source = await loadTaiwaneseSource()
const index = indexTaiwanese(source.rows)
const lines: string[] = []

if (allHsk1) {
    // One line per word with the winning form and how far to trust it. The ranking is a
    // heuristic, so low-confidence rows are the ones still to curate by hand; rows marked
    // `*` are already hand-corrected.
    const tally = { override: 0, high: 0, medium: 0, low: 0, none: 0 }

    for (const [simp] of hsk1Wordlist) {
        const trad = toTraditional(simp)
        const ranked = rankCandidates(index, simp, trad, 'hsk1')
        tally[ranked.confidence] += 1

        const best = ranked.best
        const shown = best
            ? `${(best.row.h[0] ?? best.row.tl).padEnd(8)} ${best.row.tl.padEnd(16)}`
            : '—'.padEnd(25)

        lines.push(
            `${trad.padEnd(5)} ${ranked.confidence.padEnd(8)}${ranked.overridden ? '*' : ' '} ${shown} alt:${String(ranked.alternatives.length).padStart(2)}  ${ranked.reason}`,
        )
    }

    lines.push(
        `\ncorrected ${tally.override}  high ${tally.high}  medium ${tally.medium}  low ${tally.low}  none ${tally.none}  (of ${hsk1Wordlist.length})`,
    )

    // An override whose key has drifted stops applying silently, which is the exact failure
    // the override list exists to prevent. Report it rather than trusting the counts.
    const unused = unusedTaiwaneseOverrides()
    lines.push(
        unused.length === 0
            ? 'all overrides applied'
            : `${unused.length} override(s) matched nothing: ${unused.join(', ')}`,
    )
} else {
    for (const simp of words) {
        const trad = toTraditional(simp)
        const ranked = rankCandidates(index, simp, trad, listId)

        lines.push(`\n${trad}${trad === simp ? '' : `  (${simp})`}  — ${ranked.confidence}`)

        if (!ranked.best) {
            lines.push('  no candidate in the source')
            continue
        }

        const describe = (candidate: Candidate, marker: string): string => {
            const row = candidate.row
            return `  ${marker} ${(row.h[0] ?? '—').padEnd(8)} ${row.tl.padEnd(18)} poj=${row.poj.padEnd(18)} via ${candidate.via.padEnd(9)} glossed: ${row.m.join(', ')}`
        }

        lines.push(describe(ranked.best, '>'))
        for (const alternative of ranked.alternatives) {
            lines.push(describe(alternative, ' '))
        }
        lines.push(`  why: ${ranked.reason}`)
    }
}

if (outPath) {
    await writeFile(outPath, lines.join('\n'), 'utf8')
    console.log(`wrote ${lines.length} lines to ${outPath}`)
} else {
    for (const line of lines) console.log(line)
}
