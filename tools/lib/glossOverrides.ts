/**
 * Hand corrections to the upstream glosses, applied after `parseGloss` has done its
 * mechanical normalising (see `./gloss.ts`).
 *
 * These are judgement calls - which sense a beginner should be shown, or a gloss that
 * teaches something untrue - so they cannot be derived by rule. Keeping them here
 * means `npm run data:build` reproduces them instead of reverting them.
 *
 * Keyed by `listId|simplified|numbered pinyin`, not by character alone: the same
 * character carries different glosses in different lists and only some are wrong.
 * 得 is the clear case - the junda entry's "obtain, get, gain" is correct for dé,
 * while the HSK ones are not - and 过 is fine in hsk3 and junda but wrong in hsk2.
 *
 * Because the data is CC-CEDICT-derived, every correction here is a modification that
 * has to stay declared in `data/source/SOURCES.md` under the share-alike terms.
 */
export type GlossOverride = readonly string[]

export const GLOSS_OVERRIDES: Readonly<Record<string, GlossOverride>> = {
    // Upstream pairs the nǎ reading with CC-CEDICT's definition for 哪 *něi*
    // ("which? (interrogative, followed by classifier or numeral-classifier)").
    // It is also the first word a beginner meets, and a 93-character quiz prompt.
    'hsk1|哪|na3': ['which'],

    // A 141-character grammar lecture. Same correction for both levels; note that the
    // HSK 4 entry carries the glosses for 得 děi ("to have to, to need to, must") while
    // the app derives the reading dé, so the gloss is aligned to what is displayed.
    'hsk2|得|de2': ['particle linking a verb to its result, degree or possibility'],
    'hsk4|得|de2': ['particle linking a verb to its result, degree or possibility'],

    // 过 after a verb marks *experience* ("have ever done"); completion is 了. The
    // upstream gloss says "completion", which is the confusion to avoid.
    'hsk2|过|guo4': ['(verb suffix) to have ever done', 'to pass', 'to cross'],

    // Drops a stray trailing bracket and a cross-reference sense.
    'hsk2|您|nin2': ['you (polite)'],

    // Upstream opens with a full-width bracket: "（be) clear (about)".
    'hsk3|清楚|qing1 chu3': ['clear', 'distinct', 'clearly understood'],

    // 68 characters of contract law as a quiz prompt, for a character whose everyday
    // sense is "first".
    'hsk5|甲|jia3': ['first (of a sequence)', 'armour', 'shell'],

    // 137 characters at a time. The one-word senses upstream lists later are better.
    'hsk5|成语|cheng2 yu3': ['idiom (usually four characters)', 'set phrase', 'proverb'],

    // Classifier glosses enumerate every attested object; the rule is the useful part.
    'hsk5|颗|ke1': ['classifier for small round objects'],
    'hsk6|枚|mei2': ['classifier for small flat objects'],

    // A 97-character explanation of when to use the word, plus usable senses after it.
    'hsk6|偏偏|pian1 pian1': [
        'just when (contrary to expectation)',
        'deliberately',
        'unfortunately',
    ],

    // Reads as a dictionary headword rather than a definition.
    'hsk6|简体字|jian3 ti3 zi4': ['simplified Chinese character', 'simplified form'],

    // 83 characters for a literary particle nobody is drilling at speed.
    'junda|欤|yu2': ['(literary) final particle of doubt or surprise'],
}

const applied = new Set<string>()

/** The override for an entry, if one exists, recording that it was reached. */
export function glossOverrideFor(
    listId: string,
    simp: string,
    numbered: string,
): GlossOverride | undefined {
    const key = `${listId}|${simp}|${numbered}`
    const override = GLOSS_OVERRIDES[key]
    if (override) applied.add(key)
    return override
}

/**
 * Keys that never matched an entry. A rename or a pinyin change upstream would
 * silently orphan a correction, which is worth failing loudly over.
 */
export function unusedGlossOverrides(): string[] {
    return Object.keys(GLOSS_OVERRIDES).filter((key) => !applied.has(key))
}
