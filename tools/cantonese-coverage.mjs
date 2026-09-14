/**
 * Coverage probe for Cantonese (Jyutping) readings of the HSK 1 list.
 *
 * Sibling of tools/taigi-coverage.mjs, asking the same question: if we simply swapped
 * the romanisation on each existing entry, how far would we actually get?
 *
 * It measures two things rather than one coverage number, because Cantonese fails in a
 * different place from Hokkien:
 *
 *   1. Character coverage (Unicode Unihan kCantonese). Reading written Chinese aloud in
 *      Cantonese is a normal, taught activity, so the expectation is that essentially
 *      every character is covered and the swap never runs out of data.
 *   2. Word coverage (CC-Canto, Pleco's CC-CEDICT fork with Jyutping added). Confirms
 *      the multi-character words exist as-is, rather than being assembled char by char.
 *
 * Neither number is the question a learner cares about, which is whether people *say* it
 * that way. COLLOQUIAL below is hand-curated and approximate: it sizes the set of HSK 1
 * words where spoken Cantonese uses different characters, and is not a data source.
 *
 * Downloads land in the OS temp directory, not the repo, because these datasets are
 * multi-megabyte and we have not decided to vendor anything.
 *
 * Run: node tools/cantonese-coverage.mjs
 *      node tools/cantonese-coverage.mjs 都 很 吃      # dump candidates for given words
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const DATA_DIR = join(tmpdir(), 'cantonese')
const UNIHAN = join(DATA_DIR, 'Unihan_Readings.txt')
const CC_CANTO = join(DATA_DIR, 'cccanto-webdist.txt')
const HSK1 = join(process.cwd(), 'public', 'data', 'lists', 'hsk1.json')

/**
 * Written form -> spoken Cantonese. Deliberately conservative: only pairs where a
 * Cantonese speaker would use different characters for the ordinary meaning. Entries
 * like 小 -> 細 are true for the "small in size" sense but not in compounds, so treat
 * every line as "differs in at least the common sense" rather than "never written".
 */
const COLLOQUIAL = {
    的: '嘅 ge3',
    不: '唔 m4',
    是: '係 hai6',
    在: '喺 hai2',
    了: '咗 zo2',
    沒: '冇 mou5',
    沒有: '冇 mou5',
    他: '佢 keoi5',
    她: '佢 keoi5',
    這: '呢 ni1',
    那: '嗰 go2',
    哪: '邊 bin1',
    哪兒: '邊度 bin1 dou6',
    什麼: '乜嘢 mat1 je5',
    誰: '邊個 bin1 go3',
    怎麼: '點樣 dim2 joeng2',
    多少: '幾多 gei2 do1',
    很: '好 hou2',
    吃: '食 sik6',
    喝: '飲 jam2',
    看: '睇 tai2',
    說: '講 gong2',
    走: '行 haang4',
    給: '畀 bei2',
    拿: '攞 lo2',
    站: '企 kei5',
    穿: '着 zoek3',
    睡: '瞓 fan3',
    累: '攰 gui6',
    漂亮: '靚 leng3',
    小: '細 sai3',
    些: '啲 di1',
    塊: '蚊 man1',
    元: '蚊 man1',
    別: '咪 mai5',
    和: '同 tung4',
    還是: '定係 ding6 hai6',
    喜歡: '鍾意 zung1 jyu3',
    認識: '識 sik1',
    現在: '而家 ji4 gaa1',
    今天: '今日 gam1 jat6',
    明天: '聽日 ting1 jat6',
    昨天: '昨日 zok6 jat6',
    晚上: '夜晚 je6 maan5',
    這裡: '呢度 ni1 dou6',
    那裡: '嗰度 go2 dou6',
    東西: '嘢 je5',
    名字: '名 meng2',
}

/** kCantonese gives Jyutping for the character, independent of any word it appears in. */
function loadUnihan() {
    const readings = new Map()
    for (const line of readFileSync(UNIHAN, 'utf8').split('\n')) {
        if (line.length === 0 || line.startsWith('#')) continue
        const [code, field, value] = line.split('\t')
        if (field !== 'kCantonese') continue
        readings.set(String.fromCodePoint(parseInt(code.slice(2), 16)), value.trim().split(/\s+/))
    }
    return readings
}

/** `漢字 汉字 [han4 zi4] {hon3 zi6} /gloss/` - the same format CC-CEDICT uses. */
function loadCcCanto() {
    const byWord = new Map()
    const text = readFileSync(CC_CANTO, 'utf8')

    for (const line of text.split('\n')) {
        if (line.length === 0 || line.startsWith('#')) continue
        const match = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\{([^}]*)\}/.exec(line)
        if (!match) continue

        const [, trad, simp, pinyin, jyutping] = match
        const reading = { trad, simp, pinyin, jyutping }
        // Keyed on the characters, so a hit means the swap is real rather than generated.
        for (const key of [trad, simp]) {
            if (key && !byWord.has(key)) byWord.set(key, reading)
        }
    }
    return byWord
}

const unihan = loadUnihan()
const ccCanto = loadCcCanto()
const hsk1 = JSON.parse(readFileSync(HSK1, 'utf8')).entries

const probeWords = process.argv.slice(2)

if (probeWords.length > 0) {
    for (const word of probeWords) {
        const chars = [...word]
        console.log(`\n${word}`)
        console.log(`  Unihan kCantonese: ${chars.map((c) => `${c}=${unihan.get(c)?.join('/') ?? '-'}`).join('  ')}`)
        const hit = ccCanto.get(word)
        console.log(hit ? `  CC-Canto         : ${hit.jyutping}` : '  CC-Canto         : (no entry)')
        if (COLLOQUIAL[word]) console.log(`  spoken            : ${COLLOQUIAL[word]}`)
    }
    process.exit(0)
}

const pct = (n, total = hsk1.length) => `${((n / total) * 100).toFixed(0)}%`

// 1. Does every character have a reading at all?
const affectedBy = new Map()
let fullyReadable = 0

for (const entry of hsk1) {
    const missing = [...entry.trad].filter((char) => !unihan.has(char))
    if (missing.length === 0) {
        fullyReadable += 1
        continue
    }
    for (const char of missing) {
        if (!affectedBy.has(char)) affectedBy.set(char, [])
        affectedBy.get(char).push(entry.trad)
    }
}

console.log(`HSK 1: ${hsk1.length} entries`)
console.log(
    `\ncharacters all have a Jyutping reading : ${fullyReadable}  (${pct(fullyReadable)})`,
)

if (affectedBy.size > 0) {
    console.log('  characters with no kCantonese field:')
    for (const [char, words] of affectedBy) {
        console.log(`    ${char}  (in ${words.slice(0, 6).join(', ')})`)
    }
}

// 2. Does the word itself exist in a Cantonese dictionary, unchanged?
const wordHits = hsk1.filter((entry) => ccCanto.has(entry.trad) || ccCanto.has(entry.simp))
const wordMisses = hsk1.filter((entry) => !ccCanto.has(entry.trad) && !ccCanto.has(entry.simp))

console.log(`\nword is in CC-Canto, same characters  : ${wordHits.length}  (${pct(wordHits.length)})`)

console.log('\n  the swap in action (characters unchanged, reading replaced):')
for (const entry of wordHits.slice(0, 16)) {
    const hit = ccCanto.get(entry.trad) ?? ccCanto.get(entry.simp)
    console.log(
        `    ${entry.trad.padEnd(6)} ${entry.pinyin.marked.padEnd(12)} -> ${hit.jyutping.padEnd(18)} ${entry.glossShort}`,
    )
}

console.log('\n  not in CC-Canto:')
for (const entry of wordMisses.slice(0, 16)) {
    console.log(`    ${entry.trad.padEnd(6)} ${entry.pinyin.marked.padEnd(12)} ${entry.glossShort}`)
}

// 3. How many words would a Cantonese speaker not say that way?
const differing = hsk1.filter((entry) => COLLOQUIAL[entry.trad])

console.log(
    `\nspoken Cantonese uses different characters: ${differing.length}  (${pct(differing.length)})`,
)
console.log('  (curated sample, not exhaustive - a floor, not a ceiling)\n')

for (const entry of differing) {
    const hit = ccCanto.get(entry.trad)
    console.log(
        `    ${entry.trad.padEnd(6)} ${entry.pinyin.marked.padEnd(12)} ${(hit?.jyutping ?? '-').padEnd(18)} -> ${COLLOQUIAL[entry.trad]}`,
    )
}
