/**
 * How much of a Taiwanese list the Mandarin -> Taiwanese drill can be asked of.
 *
 *   node tools/objective-coverage.mjs [listId]
 *
 * The drill needs a Mandarin counterpart whose characters differ, so the useful number is not
 * the list size but the subset where the word itself changed. Run this before assuming the
 * corpus is big enough for a session to draw four options from.
 */
import { readFile } from 'node:fs/promises'

const listId = process.argv[2] ?? 'hsk1-tw'
const raw = await readFile(`public/data/lists/${listId}.json`, 'utf8')
const { entries } = JSON.parse(raw)

const contrast = entries.filter((entry) => entry.mandarin?.differs === 'word')
const noHan = contrast.filter((entry) => entry.trad.length === 0)
const sameWord = entries.filter((entry) => entry.mandarin?.differs === 'reading')

const share = ((contrast.length / entries.length) * 100).toFixed(0)
console.log(`${listId}: ${entries.length} entries`)
console.log(`  contrast drill available : ${contrast.length} (${share}%)`)
console.log(`  reading-only difference  : ${sameWord.length}`)
console.log(`  contrast, no characters  : ${noHan.length}`)

// Length matters: buildQuestion only mixes options of the same visible length, so a word with
// no same-length peers gets a two-option question rather than a four-option one.
const byLength = new Map()
for (const entry of contrast) {
    const key = entry.trad.length
    byLength.set(key, (byLength.get(key) ?? 0) + 1)
}
console.log('  by answer length         :', [...byLength].sort().map(([n, c]) => `${n}=${c}`).join(' '))

const duplicates = new Map()
for (const entry of entries) {
    duplicates.set(entry.trad, (duplicates.get(entry.trad) ?? 0) + 1)
}
const shared = [...duplicates].filter(([, count]) => count > 1)
console.log(`  answer forms used twice  : ${shared.length}`)
