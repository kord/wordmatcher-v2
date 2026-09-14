/**
 * Hand corrections to the mechanically ranked Taiwanese forms.
 *
 * The ranking in `./taiwanese.ts` prefers a row whose characters match ours, because that
 * is usually the same word read differently (好 -> hó). It fails in one specific and very
 * common way: the character has a real Taiwanese reading that nobody says. 說 *is* read
 * `suat`, but the word for "to speak" is 講 kóng; 和 *is* read `hô`, but "and" is 佮 kah.
 * That is the literary/colloquial split, and no amount of ranking can detect it, because
 * 都 `to` and 都 `to` look identical to 和 `hô` in every signal the data carries.
 *
 * The source is also sorted alphabetically by romanisation, so where two candidates score
 * equally the winner is decided by alphabetical accident. 漂亮 picked 巧 khiáu ("clever")
 * over 媠 suí for exactly that reason.
 *
 * Keyed by `listId|simplified`, and every correction here is declared as a modification in
 * `data/source/SOURCES.md` under the source's share-alike terms.
 *
 * HSK 2 does not follow this pattern. Its forms were authored by hand first and only then
 * checked against the extract, because by that level the everyday Taiwanese word is often not
 * the character in front of you at all. Those live in `taiwaneseHsk2.ts` and are merged in below.
 */
import type { HandRow } from './handAuthored.ts'
import { HSK2_ROWS } from './taiwaneseHsk2.ts'
import { HSK3_ROWS } from './taiwaneseHsk3.ts'
import { HSK4_ROWS } from './taiwaneseHsk4.ts'
import {
    HSK5_ROWS_A,
    HSK5_ROWS_B,
    HSK5_ROWS_C,
    HSK5_ROWS_D,
    HSK5_ROWS_E,
} from './taiwaneseHsk5.ts'

/** HSK 5 is authored in five chunks purely so the file stays reviewable. */
const HSK5_ROWS: readonly HandRow[] = [
    ...HSK5_ROWS_A,
    ...HSK5_ROWS_B,
    ...HSK5_ROWS_C,
    ...HSK5_ROWS_D,
    ...HSK5_ROWS_E,
]

export interface TaiwaneseOverride {
    /** Taiwanese written form. Empty when the word is written in romanisation alone. */
    han: string
    tailo: string
    poj: string
    /** Why the ranking got this wrong, or where the form comes from. */
    reason: string
    /**
     * False when the form was asserted by hand rather than picked from a source row.
     * Those are the ones a human should check before trusting them.
     */
    fromSource: boolean
}

/**
 * A hand-authored table, in the shape the resolver expects.
 *
 * `fromSource` is false throughout: these were not picked from the dictionary, and marking them
 * otherwise would hide the one fact a reviewer needs. The note on each row becomes the reason,
 * so the explanation travels with the entry into the build output.
 */
function handAuthored(level: number, rows: readonly HandRow[]): Record<string, TaiwaneseOverride> {
    return Object.fromEntries(
        rows.map(([simp, han, tailo, poj, note]): [string, TaiwaneseOverride] => [
            `hsk${level}|${simp}`,
            {
                han,
                tailo,
                poj,
                reason: note ?? `hand-authored for HSK ${level}, checked against the extract`,
                fromSource: false,
            },
        ]),
    )
}

export const TAIWANESE_OVERRIDES: Readonly<Record<string, TaiwaneseOverride>> = {
    // --- HSK 2 and up: chosen by hand, then verified against the extract -----------------

    ...handAuthored(2, HSK2_ROWS),
    ...handAuthored(3, HSK3_ROWS),
    ...handAuthored(4, HSK4_ROWS),
    ...handAuthored(5, HSK5_ROWS),

    // --- HSK 1: corrections to the mechanically ranked forms ----------------------------
    // --- Candidates the ranking passed over: the answer was in the data all along ------

    // Character match gave 說 suat (literary "to speak"). The everyday verb is 講.
    // Not present as a candidate for 說, so this one is hand-asserted.
    'hsk1|说': {
        han: '講',
        tailo: 'kóng',
        poj: 'kóng',
        reason: 'the character reading suat is literary; the spoken verb is 講 kóng',
        fromSource: false,
    },

    // 喝 hat is "to shout at"; the translation row 啉 lim is the one that means to drink.
    'hsk1|喝': {
        han: '啉',
        tailo: 'lim',
        poj: 'lim',
        reason: 'hat means to shout; 啉 lim is the word for drinking',
        fromSource: true,
    },

    // 和 hô means "harmonious". The conjunction is 佮 kah.
    'hsk1|和': {
        han: '佮',
        tailo: 'kah',
        poj: 'kah',
        reason: 'hô is "harmonious"; the conjunction "and" is 佮 kah',
        fromSource: true,
    },

    // 在 tsāi is "to exist". Location is 佇 tī.
    'hsk1|在': {
        han: '佇',
        tailo: 'tī',
        poj: 'tī',
        reason: 'tsāi is "to exist"; the locative is 佇 tī',
        fromSource: true,
    },

    // Only a character match existed, and it is an unrelated sense ("if, supposing").
    'hsk1|那': {
        han: '彼',
        tailo: 'hit',
        poj: 'hit',
        reason: 'ná is "if"; the demonstrative is 彼 hit',
        fromSource: true,
    },

    // Two rows share the characters 合意: ha̍h-ì "to agree" and kah-ì "to like".
    'hsk1|喜欢': {
        han: '合意',
        tailo: 'kah-ì',
        poj: 'kah-ì',
        reason: 'ha̍h-ì means to agree; kah-ì is the reading that means to like',
        fromSource: true,
    },

    // 巧 khiáu is "clever" and won only on alphabetical order.
    'hsk1|漂亮': {
        han: '媠',
        tailo: 'suí',
        poj: 'súi',
        reason: 'khiáu means clever; pretty is 媠 suí',
        fromSource: true,
    },

    // 費神 huì-sîn is "to put someone to trouble", not "thank you".
    'hsk1|谢谢': {
        han: '多謝',
        tailo: 'to-siā',
        poj: 'to-siā',
        reason: 'huì-sîn means to trouble someone; 多謝 is the thanks',
        fromSource: true,
    },

    // 空空 khang-khang is "empty"; the negated verb is 無 bô.
    'hsk1|没有': {
        han: '無',
        tailo: 'bô',
        poj: 'bô',
        reason: 'khang-khang is "empty"; "not have" is 無 bô',
        fromSource: true,
    },

    // 雨來 hōo-lâi is a noun phrase; the verb is 落雨 lo̍h-hōo.
    'hsk1|下雨': {
        han: '落雨',
        tailo: 'lo̍h-hōo',
        poj: 'lo̍h-hō͘',
        reason: 'hōo-lâi is "rain comes"; to rain is 落雨 lo̍h-hōo',
        fromSource: true,
    },

    // 這陣 tsit-tsūn is "these days"; the word asked about is "today".
    'hsk1|今天': {
        han: '今仔日',
        tailo: 'kin-á-ji̍t',
        poj: 'kin-á-ji̍t',
        reason: 'tsit-tsūn means "nowadays"; today is 今仔日',
        fromSource: true,
    },

    // 昨日 tsa̍h-ji̍t is the written form. Spoken Taiwanese says 昨昏, and the source
    // carries both readings of it, so the ranking picked between them alphabetically.
    'hsk1|昨天': {
        han: '昨昏',
        tailo: 'tsa-hng',
        poj: 'cha-hng',
        reason: '昨日 is the written form; spoken Taiwanese says 昨昏',
        fromSource: true,
    },

    // 摃 kòng is to hit; the source also lists 拍電話 phah-tiān-uē.
    'hsk1|打电话': {
        han: '拍電話',
        tailo: 'phah-tiān-uē',
        poj: 'phah-tiān-ōe',
        reason: 'kòng means to hit; to phone is 拍電話 phah-tiān-uē',
        fromSource: true,
    },

    // 睏眠 khùn-bîn is not idiomatic as a verb phrase; 睏 khùn is "to sleep".
    'hsk1|睡觉': {
        han: '睏',
        tailo: 'khùn',
        poj: 'khùn',
        reason: 'the plain verb is 睏 khùn',
        fromSource: true,
    },

    // 誰 tsiâ is the literary reading; 啥人 siánn-lâng is what is said.
    'hsk1|谁': {
        han: '啥人',
        tailo: 'siánn-lâng',
        poj: 'siáⁿ-lâng',
        reason: 'tsiâ is the literary reading; the spoken word is 啥人',
        fromSource: true,
    },

    // --- Hand-asserted: the dictionary has nothing usable ------------------------------

    // 塊 as a unit of money. The only candidate was bu̍h, and the everyday word is 箍.
    'hsk1|块': {
        han: '箍',
        tailo: 'khoo',
        poj: 'kho͘',
        reason: 'bu̍h is a coin unit; money is counted in 箍 khoo',
        fromSource: false,
    },

    // 免客氣 is the standard reply to thanks. The extract has no row for 不客氣.
    'hsk1|不客气': {
        han: '免客氣',
        tailo: 'bián kheh-khì',
        poj: 'bián kheh-khì',
        reason: 'the set phrase, absent from the source extract',
        fromSource: false,
    },

    // Taiwan says 計程車 where the mainland says 出租車. Tai-lo merges POJ's `eng` into `ing`
    // and writes `ts` where POJ writes `ch`, so the two spellings differ throughout.
    'hsk1|出租车': {
        han: '計程車',
        tailo: 'kè-tîng-tshia',
        poj: 'kè-têng-chhia',
        reason: 'Taiwanese uses 計程車, not the Mandarin 出租車',
        fromSource: false,
    },

    // --- Everyday words the dictionary only knows in a literary reading ------------------
    //
    // These are the words a beginner meets first and uses most, which makes a literary
    // answer worse than no answer: it is a form a Taiwanese listener hears as stilted, and
    // it is the one thing in the list they will try out on a real person within a week.
    // Each correction below is the ordinary spoken word.

    // 不 put is the reading inside compounds (公平 put-kong-pîng). The plain negator is 毋 m̄.
    'hsk1|不': {
        han: '毋',
        tailo: 'm̄',
        poj: 'm̄',
        reason: 'put is the compound reading; the everyday negator is 毋 m̄',
        fromSource: false,
    },

    // 哪 ná in Taiwanese means "how could it be". "Which" is 佗.
    'hsk1|哪': {
        han: '佗',
        tailo: 'tó',
        poj: 'tó',
        reason: 'ná means "how could it"; "which" is 佗 tó',
        fromSource: false,
    },

    // A yes-no question closes with 無, the same word that negates 有.
    'hsk1|吗': {
        han: '無',
        tailo: 'bô',
        poj: 'bô',
        reason: 'yes-no questions close with 無 bô',
        fromSource: false,
    },

    // 太 thuè is the character reading; "too much" is 傷.
    'hsk1|太': {
        han: '傷',
        tailo: 'siunn',
        poj: 'sioⁿ',
        reason: 'thuè is the character reading; "too much" is 傷 siunn',
        fromSource: false,
    },

    // 些 has no standalone Taiwanese form; "some" is 寡, as in 一寡.
    'hsk1|些': {
        han: '寡',
        tailo: 'kuá',
        poj: 'kúa',
        reason: '"some" is 寡 kuá, as in 一寡 tsi̍t-kuá',
        fromSource: false,
    },

    // 一寸仔 is built on 寸 "inch", which is not the word.
    'hsk1|一点儿': {
        han: '一點仔',
        tailo: 'tsi̍t-tiám-á',
        poj: 'chi̍t-tiám-á',
        reason: '一寸仔 is built on 寸 "inch"; "a little" is 一點仔',
        fromSource: false,
    },

    // The gloss is the particle, not the verb: 了 liáu means "to finish".
    'hsk1|了': {
        han: '矣',
        tailo: '--ah',
        poj: '--ah',
        reason: 'liáu means "to finish"; the perfect particle is 矣 --ah',
        fromSource: false,
    },

    // 一 i̍t is the literary reading. Counting uses tsi̍t, and the numerals are the first
    // thing a beginner drills, so the register matters more here than anywhere else.
    // 二 and 八 below are the same problem, and the source carries both readings of each,
    // which is why the ranking could not choose: pat sorts before peh, and the character
    // match for 二 has nothing to distinguish it from the one it should lose to.
    'hsk1|一': {
        han: '一',
        tailo: 'tsi̍t',
        poj: 'chi̍t',
        reason: 'i̍t is the literary reading; counting uses tsi̍t',
        fromSource: true,
    },
    // The source lists 兩 twice, as `nn̄g` and as `nōo`, and the `nn̄g` row carries a Tai-lo
    // spelling in its POJ column. This takes the row whose two columns each agree with their
    // own scheme; the data quality test asserts that they do.
    'hsk1|二': {
        han: '兩',
        tailo: 'nōo',
        poj: 'nō͘',
        reason: 'jī is the digit reading; counting uses 兩',
        fromSource: true,
    },
    'hsk1|八': {
        han: '八',
        tailo: 'peh',
        poj: 'peh',
        reason: 'pat is the literary reading; counting uses peh',
        fromSource: true,
    },

    // The source gave bâ; the word for a cat is 貓 niau.
    'hsk1|猫': {
        han: '貓',
        tailo: 'niau',
        poj: 'niau',
        reason: 'the everyday word is 貓 niau',
        fromSource: false,
    },

    // The reading was already right; 物 is the standard way to write it, where 乜 is a
    // variant. Worth normalising on the highest-frequency question word in the list.
    'hsk1|什么': {
        han: '啥物',
        tailo: 'siánn-mih',
        poj: 'siáⁿ-mih',
        reason: 'standard spelling of the reading the ranking already found',
        fromSource: false,
    },

    // --- Numerals and simple words the dictionary does not gloss at all ------------------

    'hsk1|三': { han: '三', tailo: 'sann', poj: 'saⁿ', reason: 'numeral, absent from the extract', fromSource: false },
    'hsk1|十': { han: '十', tailo: 'tsa̍p', poj: 'cha̍p', reason: 'numeral, absent from the extract', fromSource: false },
    'hsk1|读': { han: '讀', tailo: 'tha̍k', poj: 'tha̍k', reason: 'reading, absent from the extract', fromSource: false },
    'hsk1|北京': { han: '北京', tailo: 'Pak-kiann', poj: 'Pak-kiaⁿ', reason: 'place name, absent from the extract', fromSource: false },
    'hsk1|喂': { han: '喂', tailo: 'ue', poj: 'oe', reason: 'greeting, absent from the extract', fromSource: false },
    'hsk1|哪儿': { han: '佗位', tailo: 'tó-uī', poj: 'tó-ūi', reason: 'interrogative, absent from the extract', fromSource: false },
}

const applied = new Set<string>()

/** The override for an entry, if one exists, recording that it was reached. */
export function taiwaneseOverrideFor(listId: string, simp: string): TaiwaneseOverride | undefined {
    const key = `${listId}|${simp}`
    const override = TAIWANESE_OVERRIDES[key]
    if (override) applied.add(key)
    return override
}

/**
 * Overrides that matched nothing.
 *
 * A key whose spelling or list has drifted stops applying silently: the correction is gone
 * but the build still succeeds. The data build fails on a non-empty result.
 */
export function unusedTaiwaneseOverrides(): string[] {
    return Object.keys(TAIWANESE_OVERRIDES).filter((key) => !applied.has(key))
}
