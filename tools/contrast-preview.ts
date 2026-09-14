/**
 * Prints a sample of the Mandarin -> Taiwanese contrast questions the app would generate.
 *
 *   npx tsx tools/contrast-preview.ts [listId]
 *
 * Useful for eyeballing the drill without playing twenty rounds hoping one comes up. Writes
 * UTF-8 itself rather than printing, because PowerShell mangles CJK on the way to the console.
 */
import { readFile } from 'node:fs/promises'
import { writeReport } from './lib/tmp.ts'
import { buildQuestion } from '../src/domain/distractors'
import { taskHintFor } from '../src/domain/faces'
import { chooseObjective } from '../src/domain/objectives'
import { mulberry32 } from '../src/domain/rng'
import type { WordEntry } from '../src/domain/types'

const listId = process.argv[2] ?? 'hsk1-tw'
const file = JSON.parse(await readFile(`public/data/lists/${listId}.json`, 'utf8')) as {
    entries: WordEntry[]
}

const pool = file.entries
const lines: string[] = []
let draws = 0
let contrast = 0

for (let seed = 0; seed < 4000 && contrast < 14; seed += 1) {
    const rng = mulberry32(seed)
    const entry = pool[Math.floor(rng() * pool.length)]
    if (!entry) continue

    draws += 1
    const objective = chooseObjective(rng, entry)
    if (objective !== 'zh-tw') continue

    const question = buildQuestion({
        entry,
        objective,
        pool,
        optionCount: 4,
        charset: 'trad',
        scheme: 'tailo',
        rng,
    })

    contrast += 1
    lines.push(taskHintFor(question.objective))
    lines.push(`  prompt    ${question.prompt.text}   [${question.prompt.kind}]`)
    for (const option of question.options) {
        lines.push(`  ${option.isAnswer ? '*' : ' '} option   ${option.face.text}   [${option.face.kind}]`)
    }
    lines.push('')
}

lines.unshift(
    `${contrast} contrast questions in ${draws} draws (${((contrast / draws) * 100).toFixed(1)}%)`,
    `list: ${listId}, ${pool.length} words`,
    '',
)

console.log(await writeReport('contrast-preview.txt', lines.join('\n')))
