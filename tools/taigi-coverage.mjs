/**
 * Coverage probe for Taiwanese Hokkien (POJ) readings of the HSK 1 list.
 *
 * Read-only and deliberately outside the build: before committing to a romanisation
 * option we want to know how much of the vocabulary can actually be given a POJ
 * reading, and how good the matches are.
 *
 * Downloads land in the OS temp directory, not the repo, because the datasets are
 * multi-megabyte and we have not decided to vendor them yet.
 *
 * Run: node tools/taigi-coverage.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SOURCES = [
    { name: 'iTaigi (CC0)', file: 'ChhoeTaigi_iTaigiHoataiTuichiautian.csv' },
    { name: 'Tai-hoa (CC BY-SA 4.0)', file: 'ChhoeTaigi_TaihoaSoanntengTuichiautian.csv' },
]

const DATA_DIR = join(tmpdir(), 'taigi')
const HSK1 = join(process.cwd(), 'public', 'data', 'lists', 'hsk1.json')

/** Fields are quoted and may contain commas, quotes and newlines. */
function parseCsv(text) {
    const rows = []
    let row = []
    let field = ''
    let quoted = false

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i]
        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"'
                    i += 1
                } else {
                    quoted = false
                }
            } else {
                field += char
            }
        } else if (char === '"') {
            quoted = true
        } else if (char === ',') {
            row.push(field)
            field = ''
        } else if (char === '\n') {
            row.push(field)
            rows.push(row)
            row = []
            field = ''
        } else if (char !== '\r') {
            field += char
        }
    }
    if (field.length > 0 || row.length > 0) row.push(field), rows.push(row)

    return rows
}

/** The Mandarin column often lists alternatives; index every one of them. */
const MANDARIN_SEPARATORS = /[、／/;；,，]/

function loadSource(source) {
    const text = readFileSync(join(DATA_DIR, source.file), 'utf8')
    const [header, ...rows] = parseCsv(text)
    const at = (name) => {
        const index = header.indexOf(name)
        if (index < 0) throw new Error(`${source.file} has no column ${name}`)
        return index
    }

    const han = at('HoaBun')
    const poj = at('PojUnicode')
    const taibun = header.includes('HanLoTaibunPoj') ? at('HanLoTaibunPoj') : -1
    const HAN = /[\u4e00-\u9fff]/

    // Two joins, because the datasets answer two different questions:
    //
    //   byCharacters - the Taiwanese writing uses these same characters, so the POJ is a
    //                  reading of the word we already have (不 -> 不 put).
    //   byMandarin   - only the Mandarin gloss matches, so the POJ is the Taiwanese word
    //                  for that meaning, usually written differently (吃 -> 食 chia̍h,
    //                  都 -> 攏 lóng). Showing that beside 都 would pair the wrong sound
    //                  with the wrong character.
    const byCharacters = new Map()
    const byMandarin = new Map()

    for (const row of rows) {
        const pojValue = (row[poj] ?? '').trim()
        if (!pojValue) continue

        if (taibun >= 0) {
            for (const variant of (row[taibun] ?? '').split(MANDARIN_SEPARATORS)) {
                const key = variant.trim()
                if (!key || !HAN.test(key)) continue
                if (!byCharacters.has(key)) byCharacters.set(key, { poj: pojValue, taibun: key })
            }
        }

        for (const variant of (row[han] ?? '').split(MANDARIN_SEPARATORS)) {
            const key = variant.trim()
            if (!key) continue
            // First entry wins: sources are ordered by their own priority.
            if (!byMandarin.has(key)) {
                byMandarin.set(key, { poj: pojValue, taibun: taibun >= 0 ? row[taibun] : '' })
            }
        }
    }

    return { rows: rows.length, byCharacters, byMandarin }
}

const hsk1 = JSON.parse(readFileSync(HSK1, 'utf8')).entries

// `node tools/taigi-coverage.mjs 吃 不` dumps every candidate row for those Mandarin
// forms, which is how we check whether a match is a real equivalent or an artefact of
// first-entry-wins indexing.
const probeWords = process.argv.slice(2)

if (probeWords.length > 0) {
    for (const source of SOURCES) {
        const text = readFileSync(join(DATA_DIR, source.file), 'utf8')
        const [header, ...rows] = parseCsv(text)
        const han = header.indexOf('HoaBun')
        const poj = header.indexOf('PojUnicode')
        const taibun = header.indexOf('HanLoTaibunPoj')

        for (const word of probeWords) {
            console.log(`\n=== ${source.name} :: ${word}`)
            let shown = 0
            for (const row of rows) {
                const mandarin = row[han] ?? ''
                if (!mandarin.split(MANDARIN_SEPARATORS).some((v) => v.trim() === word)) continue
                shown += 1
                if (shown > 8) break
                console.log(
                    `    characters=${(row[taibun] ?? '').padEnd(10)} poj=${(row[poj] ?? '').padEnd(18)} mandarin=${mandarin.slice(0, 40)}`,
                )
            }
            if (shown === 0) console.log('    (no row whose Mandarin column equals this word)')
        }
    }
    process.exit(0)
}

console.log(`HSK 1: ${hsk1.length} entries\n`)

for (const source of SOURCES) {
    const { rows, byCharacters, byMandarin } = loadSource(source)
    console.log(
        `=== ${source.name} - ${rows} rows, ${byCharacters.size} Han headwords, ${byMandarin.size} Mandarin forms`,
    )

    const readings = []
    const equivalents = []
    const misses = []

    for (const entry of hsk1) {
        const reading = byCharacters.get(entry.trad) ?? byCharacters.get(entry.simp)
        if (reading) {
            readings.push({ entry, match: reading })
            continue
        }
        const equivalent = byMandarin.get(entry.trad) ?? byMandarin.get(entry.simp)
        if (equivalent) equivalents.push({ entry, match: equivalent })
        else misses.push(entry)
    }

    const pct = (n) => `${((n / hsk1.length) * 100).toFixed(0)}%`
    console.log(`  same characters, so a true reading : ${readings.length}  (${pct(readings.length)})`)
    console.log(`  different characters, a translation: ${equivalents.length}  (${pct(equivalents.length)})`)
    console.log(`  no match at all                    : ${misses.length}  (${pct(misses.length)})\n`)

    console.log('  readings (character unchanged):')
    for (const { entry, match } of readings.slice(0, 14)) {
        console.log(`    ${entry.trad}  ${entry.pinyin.marked.padEnd(12)} -> ${match.poj.padEnd(16)} ${entry.glossShort}`)
    }

    console.log('\n  translations (character would have to change):')
    for (const { entry, match } of equivalents.slice(0, 14)) {
        console.log(
            `    ${entry.trad} -> ${String(match.taibun).padEnd(8)} ${match.poj.padEnd(16)} ${entry.glossShort}`,
        )
    }

    console.log('\n  unmatched:')
    for (const entry of misses.slice(0, 14)) {
        console.log(`    ${entry.trad}  ${entry.pinyin.marked.padEnd(12)} ${entry.glossShort}`)
    }
    console.log('')
}
