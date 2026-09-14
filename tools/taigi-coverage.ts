/**
 * How much of a Mandarin list the Taiwanese extract can say anything about.
 *
 *   npx tsx tools/taigi-coverage.ts [--from 4] [--to 6]
 *
 * HSK 4 and up are a different shape of job from HSK 1-3: the vocabulary is mostly two-character
 * compounds that Taiwanese reads with the same characters, so most words differ in reading rather
 * than in word. That changes how much the dictionary can confirm and how much has to be asserted
 * by hand, which is worth knowing before writing the rows.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { candidatesFor, indexTaiwanese, loadTaiwaneseSource } from './lib/taiwanese.ts'
import { writeReport } from './lib/tmp.ts'

const args = process.argv.slice(2)
const flag = (name: string, fallback: number) => {
    const at = args.indexOf(`--${name}`)
    return at >= 0 ? Number(args[at + 1]) : fallback
}

const from = flag('from', 4)
const to = flag('to', 6)

const source = await loadTaiwaneseSource()
const index = indexTaiwanese(source.rows)

const lines: string[] = []
const summary: string[] = []

for (let level = from; level <= to; level += 1) {
    const file = JSON.parse(
        await readFile(join(process.cwd(), 'public', 'data', 'lists', `hsk${level}.json`), 'utf8'),
    ) as { entries: { simp: string; trad: string; glossShort: string }[] }

    let byCharacters = 0
    let byGloss = 0
    let nothing = 0
    const needsJudgement: string[] = []

    for (const entry of file.entries) {
        const candidates = candidatesFor(index, entry.simp, entry.trad)
        if (candidates.some((candidate) => candidate.via === 'characters')) byCharacters += 1
        else if (candidates.length > 0) {
            byGloss += 1
            // The dictionary knows the meaning but not as this word, so someone has to decide
            // which Taiwanese word it actually is.
            needsJudgement.push(`  ${entry.simp} (${entry.trad}) — ${entry.glossShort}`)
        } else {
            nothing += 1
            needsJudgement.push(`  ${entry.simp} (${entry.trad}) — ${entry.glossShort}   [absent]`)
        }
    }

    const total = file.entries.length
    const share = (n: number) => `${((n / total) * 100).toFixed(0)}%`

    summary.push(
        `hsk${level}: ${total} words — characters ${byCharacters} (${share(byCharacters)}), ` +
            `gloss only ${byGloss} (${share(byGloss)}), nothing ${nothing} (${share(nothing)})`,
    )
    lines.push(`HSK ${level}`)
    lines.push(`  words                    ${total}`)
    lines.push(`  source shares our chars  ${byCharacters}`)
    lines.push(`  source gloss-only match  ${byGloss}`)
    lines.push(`  source has nothing       ${nothing}`)
    lines.push('')
    lines.push(`  words needing a decision (${needsJudgement.length}):`)
    lines.push(...needsJudgement)
    lines.push('')
}

const out = await writeReport('taigi-coverage.txt', [...summary, '', ...lines].join('\n'))
console.log(out)
