/**
 * Proves that the POJ column of every hand-authored row is really POJ.
 *
 * `taigiDataQuality.test.ts` can only see rows where the POJ column is *identical* to the
 * Tai-lo one. That catches a wholesale copy but not a half-finished conversion: 裝飾 written
 * as `tsng-sek` differs from `tsng-sik`, so it passes, and still says `tsng` where POJ says
 * `chng`. Reviewing 2,347 rows for the same mistake by eye is how it happened in the first
 * place, so this converts the Tai-lo spelling to the POJ spelling mechanically and compares.
 *
 *   npx tsx tools/poj-check.ts
 *
 * Two things are compared, both scheme-independent:
 *   - the letters, with the tone diacritics set aside, so `tsuá` and `chóa` must reduce to the
 *     same skeleton and `tsng-sek` and `chng-sek` must not;
 *   - the tone of each syllable, so a reading cannot drift from tone 7 to tone 3 on the way
 *     across.
 *
 * The conversion table below is not recalled from the literature, it is read off the source:
 * `tools/scheme-pairs.ts` aligns every row of the extract carrying both romanisations, and the
 * differences that actually occur are the ones encoded here. That is also what settles the two
 * traps in this conversion. Tai-lo never writes `oa` - every rime the source spells with `ua`
 * on the Tai-lo side appears as `oa` in POJ - so a POJ cell containing `ua` is a leak, and so
 * is a Tai-lo cell containing `oa`. And where POJ has `eng`/`ek`, Tai-lo has *either* `eng`/`ek`
 * or `ing`/`ik`, so both Tai-lo spellings have to fold onto the POJ one; a POJ cell still
 * holding `ing`/`ik` is therefore always a leak.
 *
 * Reports to `tmp/poj-check.txt`; the console only ever sees the path, because the Windows
 * console cannot print the characters involved.
 */
import { writeReport } from './lib/tmp.ts'
import type { HandRow } from './lib/handAuthored.ts'
import { HSK2_ROWS } from './lib/taiwaneseHsk2.ts'
import { HSK3_ROWS } from './lib/taiwaneseHsk3.ts'
import { HSK4_ROWS } from './lib/taiwaneseHsk4.ts'
import {
    HSK5_ROWS_A,
    HSK5_ROWS_B,
    HSK5_ROWS_C,
    HSK5_ROWS_D,
    HSK5_ROWS_E,
} from './lib/taiwaneseHsk5.ts'

const TABLES: ReadonlyArray<readonly [number, readonly HandRow[]]> = [
    [2, HSK2_ROWS],
    [3, HSK3_ROWS],
    [4, HSK4_ROWS],
    [5, [...HSK5_ROWS_A, ...HSK5_ROWS_B, ...HSK5_ROWS_C, ...HSK5_ROWS_D, ...HSK5_ROWS_E]],
]

/** The dot of `o͘` is a combining mark that lives in the same block as the tone diacritics. */
const O_DOT = '\u0358'

/**
 * Tone diacritics by combining character. Tones 1 and 4 carry no mark - tone 4 is the one that
 * ends in p, t, k or h, which the spelling already shows.
 */
const TONE_OF_MARK: Readonly<Record<string, number>> = {
    ['\u0300']: 3, // grave
    ['\u0301']: 2, // acute
    ['\u0302']: 5, // circumflex
    ['\u0304']: 7, // macron
    ['\u030C']: 3, // caron
    ['\u030D']: 8, // vertical line above
}

/**
 * Tai-lo spellings reduced to a scheme-neutral skeleton, with the tone marks set aside.
 *
 * The nasalisation rule has to run before the vowel rules, or `puann` would lose its `ua` to
 * `/ua/` first and never offer the vowel the `nn` rule is looking for. As a syllable *onset*
 * `nn` is the onset in both schemes - 卵 is `nn̄g` either way - so that rule needs a vowel in
 * front of it.
 */
const TAI_LO_SKELETON: ReadonlyArray<readonly [RegExp, string]> = [
    [/([aeiou])nn/g, '$1\u0008'],
    [/tsh/g, '\u0001'],
    [/ts/g, '\u0002'],
    [/ing/g, '\u0004'],
    [/eng/g, '\u0004'],
    [/ik/g, '\u0005'],
    [/ek/g, '\u0005'],
    [/ue/g, '\u0006'],
    [/ua/g, '\u0007'],
    [/oo/g, '\u0003'],
]

/** The same for POJ. `chh` has to be tried before `ch`, so it is written first. */
const POJ_SKELETON: ReadonlyArray<readonly [RegExp, string]> = [
    [/chh/g, '\u0001'],
    [/ch/g, '\u0002'],
    [new RegExp(`o${O_DOT}`, 'g'), '\u0003'],
    [/eng/g, '\u0004'],
    [/ek/g, '\u0005'],
    [/oe/g, '\u0006'],
    [/oa/g, '\u0007'],
    [/ⁿ/g, '\u0008'],
]

const ALL_MARKS = /[\u0300-\u036f]/g

/**
 * Decomposition has to happen before the substitutions rather than after, because `uá` is `u`,
 * a combining acute and then `a` - a `/ua/` that runs first never sees the letters that are
 * actually there. The `o͘` dot is exempted from the stripping, since it is part of the letter.
 */
function skeleton(marked: string, rules: ReadonlyArray<readonly [RegExp, string]>): string {
    const letters = marked
        .normalize('NFD')
        .replace(ALL_MARKS, (mark) => (mark === O_DOT ? mark : ''))

    let out = letters
    for (const [pattern, replacement] of rules) out = out.replace(pattern, replacement)
    return out
}

/** The tone of each syllable in order, reading a neutral tone as 0. */
function tones(marked: string): string {
    return marked
        .normalize('NFD')
        .split('-')
        .map((syllable) => {
            if (syllable.startsWith('-')) return '0'
            // The dot of `o͘` is a combining mark too, and `oo` has no dot at all, so it has to
            // go before looking for the tone - otherwise every plain `oo` reads as a tone.
            const mark = syllable.replaceAll(O_DOT, '').match(ALL_MARKS)?.[0]
            return mark ? String(TONE_OF_MARK[mark] ?? '?') : '1'
        })
        .join('')
}

const lines: string[] = []
let checked = 0
let wrong = 0

for (const [level, rows] of TABLES) {
    const spelling: string[] = []
    const tone: string[] = []

    for (const [simp, han, tailo, poj] of rows) {
        checked += 1

        if (skeleton(tailo, TAI_LO_SKELETON) !== skeleton(poj, POJ_SKELETON)) {
            spelling.push(`  ${simp} ${han} ${tailo} — wrote ${poj}`)
            wrong += 1
        }

        if (tones(tailo) !== tones(poj)) {
            tone.push(`  ${simp} ${han} ${tailo} — wrote ${poj}`)
            wrong += 1
        }
    }

    lines.push(`HSK ${level}: ${rows.length} rows`)
    lines.push(`  ${spelling.length} with a POJ spelling problem`)
    lines.push(...spelling)
    lines.push(`  ${tone.length} with a tone that changed on the way across`)
    lines.push(...tone)
    lines.push('')
}

lines.push(`checked ${checked} rows, ${wrong} offenders`)
const out = await writeReport('poj-check.txt', lines.join('\n'))
console.log(out)
