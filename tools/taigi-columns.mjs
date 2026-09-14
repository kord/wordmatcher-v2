/**
 * Which romanisation columns do the ChhoeTaigi datasets actually give us?
 *
 * Taiwan's official romanisation is Tai-lo (臺羅), not POJ, and the two differ in ways a
 * Taiwanese learner will notice immediately (ch/chh -> ts/tsh, o. -> oo, superscript-n ->
 * nn). If the data already carries Tai-lo we get it for free; if not, we need a converter.
 *
 * The columns are named PojUnicode and KipUnicode, and it is not obvious what "Kip" is,
 * so this measures it rather than trusting the name.
 *
 * Run: node tools/taigi-columns.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const files = ['ChhoeTaigi_TaihoaSoanntengTuichiautian.csv', 'ChhoeTaigi_iTaigiHoataiTuichiautian.csv']

const O_DOT = 'o\u030d' // o + combining dot above, the POJ-only vowel

for (const file of files) {
    const text = readFileSync(join(tmpdir(), 'taigi', file), 'utf8')
    const [header, ...lines] = text.split(/\r?\n/)
    const columns = header.split(',').map((c) => c.replaceAll('"', ''))
    const at = (name) => columns.indexOf(name)

    const rows = lines
        .filter((line) => line.length > 0)
        .map((line) => line.split(',').map((cell) => cell.replaceAll('"', '')))
        .filter((cells) => cells.length === columns.length)

    const han = at('HanLoTaibunPoj')
    const poj = at('PojUnicode')
    const kip = at('KipUnicode')

    console.log(`\n=== ${file}`)
    console.log(`  rows                        ${rows.length}`)
    console.log(`  POJ uses ch/chh             ${rows.filter((r) => /ch/.test(r[poj])).length}`)
    console.log(`  KIP uses ts/tsh             ${rows.filter((r) => /ts/.test(r[kip])).length}`)
    console.log(`  POJ uses o + combining dot  ${rows.filter((r) => r[poj].includes(O_DOT)).length}`)
    console.log(`  KIP uses oo                 ${rows.filter((r) => r[kip].includes('oo')).length}`)

    // Which combining marks actually appear, and how often. This decides one thing that
    // would make a shared parser wrong: whether POJ's o-with-dot is the same codepoint as
    // the 8th-tone mark. If it is, stripping tone marks would also eat the vowel.
    for (const [label, index] of [
        ['POJ', poj],
        ['KIP', kip],
    ]) {
        const tally = new Map()
        for (const row of rows) {
            for (const char of row[index].normalize('NFD')) {
                const code = char.codePointAt(0)
                if (code >= 0x0300 && code <= 0x036f) {
                    tally.set(code, (tally.get(code) ?? 0) + 1)
                }
            }
        }

        const described = [...tally.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}(${count})`)
        console.log(`  ${label} combining marks       ${described.join(' ')}`)
    }

    const subset = rows.filter((r) => /ch/.test(r[poj])).slice(0, 8)
    console.log('  side by side (han | PojUnicode | KipUnicode):')
    for (const row of subset) {
        console.log(`    ${row[han].padEnd(8)} ${row[poj].padEnd(18)} ${row[kip]}`)
    }
}
