/**
 * Shared domain types.
 *
 * This module must stay dependency-free: it is imported by both the browser app
 * and the Node build-time data pipeline (`tools/build-data.ts`).
 */

/* ------------------------------------------------------------------ content */

/**
 * Which language variety a list teaches.
 *
 * Everything the learner accumulates is scoped by this: progress, session history, and the
 * list, script and romanisation choices. Drilling Mandarin must not move anything in the
 * Taiwanese lessons, and the two share no words even where the characters look identical.
 */
export type Language = 'mandarin' | 'taiwanese'

/**
 * Tone number.
 *
 * Mandarin uses 0 for the neutral tone and 1-4 for the rest. Tai-lo and POJ use 1, 2, 3, 4,
 * 5, 7 and 8, with no sixth, and 0 covers a non-Chinese token. One field serves both
 * because nothing ever renders the two systems at once.
 */
export type Tone = 0 | 1 | 2 | 3 | 4 | 5 | 7 | 8

/** A romanisation system. Mandarin lists carry `pinyin`; Taiwanese lists carry both. */
export type RomanizationScheme = 'pinyin' | 'tailo' | 'poj'

export interface RomanizationSyllable {
    /** Syllable without tone marks, e.g. `ni` or `tsiah`. */
    base: string
    /** Syllable with tone diacritics, e.g. `nǐ` or `tsia̍h`. */
    marked: string
    tone: Tone
    /**
     * True when this syllable was produced from a Chinese character. False for
     * punctuation or Latin text that `pinyin-pro` passes through unchanged, so
     * renderers know not to attach a tone marker.
     */
    han: boolean
}

export interface Romanization {
    scheme: RomanizationScheme
    /** Space separated tone-marked form: `nǐ hǎo`, or `tsia̍h pn̄g`. */
    marked: string
    /** Space separated numbered form: `ni3 hao3`, or `tsiah8 png7`. */
    numbered: string
    syllables: RomanizationSyllable[]
}

export interface Classifier {
    char: string
    /** Numbered pinyin exactly as it appears upstream, e.g. `ge4`. */
    pinyin: string
}

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface WordEntry {
    /** Stable across lists and rebuilds: hash of language + form + primary reading. */
    id: string
    /** Which variety this word belongs to. A Taiwanese entry *is* a Taiwanese word. */
    language: Language
    simp: string
    trad: string
    /**
     * Every romanisation held for this word, keyed by scheme.
     *
     * A Mandarin entry carries `pinyin`; a Taiwanese one carries `tailo` and `poj` both,
     * because the orthography is a display choice and switching it should not mean
     * rebuilding the data. Consumers pick with `romanizationFor`.
     */
    romanizations: Partial<Record<RomanizationScheme, Romanization>>
    /** Every sense, split on `;` and cleaned. */
    glosses: string[]
    /** First sense, used for compact answer options. */
    glossShort: string
    classifiers: Classifier[]
    listId: string
    hsk?: HskLevel
    /** Position in the Jun Da frequency list (1 = most frequent). */
    rank?: number
    /** Taiwanese entries only: the Mandarin word this one answers for. */
    mandarin?: MandarinCounterpart
}

/**
 * The Mandarin word a Taiwanese entry stands for.
 *
 * Carried on the entry rather than looked up, because the contrast is the lesson: the
 * learner already knows 吃, and what they need is to stop saying it. `differs` is what
 * lets the reveal and the mistake review say *which kind* of difference they are looking
 * at, instead of showing two sets of characters and leaving them to work it out.
 */
export interface MandarinCounterpart {
    simp: string
    trad: string
    glossShort: string
    /** The Mandarin reading, so the contrast can show sound as well as characters. */
    pinyin: Romanization
    /** `word`: different characters (吃 -> 食). `reading`: same characters (好 -> hó). */
    differs: 'word' | 'reading'
    /** Why this form, when the ranking had to be overruled. */
    note?: string
}

export type ListKind = 'hsk' | 'junda'

export interface ListManifestEntry {
    id: string
    name: string
    subtitle: string
    count: number
    file: string
    bytes: number
    kind: ListKind
    /** Which variety this list teaches, so the home screen can filter by it. */
    language: Language
    level?: HskLevel
}

export interface ListManifest {
    version: number
    generatedAt: string
    lists: ListManifestEntry[]
}

export interface WordListFile {
    id: string
    name: string
    entries: WordEntry[]
}

/* ------------------------------------------------------ scheduling / sessions */

export type Objective = 'zh-en' | 'en-zh' | 'zh-pinyin' | 'pinyin-zh' | 'zh-tw'

export type SessionLength =
    | { unit: 'rounds'; value: number }
    | { unit: 'time'; value: number }

export type PinyinStyle = 'diacritic' | 'numbers' | 'superscript'

export type CharacterSet = 'simp' | 'trad'

export interface PinyinDisplay {
    style: PinyinStyle
    toneColours: boolean
}

export interface ProgressRecord {
    wordId: string
    /**
     * Which variety this record belongs to.
     *
     * Records written before Taiwanese existed have no value on disk; the storage layer
     * fills in `mandarin`, which is what they all were.
     */
    language: Language
    /** Leitner box, 0 (weakest) to 5 (strongest). */
    box: number
    correctStreak: number
    lapses: number
    seen: number
    correct: number
    dueAt: number
    lastSeenAt: number
    totalMs: number
}

export type FaceKind = 'han' | 'gloss' | 'romanization' | 'mandarin'

/**
 * One rendered surface: characters, an English gloss, a romanisation, or the Mandarin
 * characters that a Taiwanese word answers for.
 */
export interface QuestionFace {
    kind: FaceKind
    /**
     * Plain text form, always populated (used for accessibility and speech).
     *
     * For a 'han' face on a Taiwanese word with no settled character this holds the
     * romanisation instead, because there is no character to show.
     */
    text: string
    /** Present only when `kind` is 'romanization'. */
    romanization?: Romanization
}

export interface QuestionOption {
    /** Unique within the question; doubles as the React key and the answer payload. */
    id: string
    /** The dictionary entry behind this option, when it is a real word. */
    entry?: WordEntry
    face: QuestionFace
    isAnswer: boolean
}

export interface Question {
    id: string
    objective: Objective
    /** The word being tested. */
    entry: WordEntry
    prompt: QuestionFace
    options: QuestionOption[]
}

export type Outcome = 'correct' | 'incorrect'

/** Lightweight record of a miss, sufficient to drive the review screen. */
export interface MistakeRecord {
    entry: WordEntry
    objective: Objective
    /** What the player actually tapped. */
    chosenText: string
    correctText: string
    msToAnswer: number
}

export interface AnsweredQuestion {
    question: Question
    chosenId: string
    outcome: Outcome
    msToAnswer: number
}

export interface SessionSummary {
    total: number
    correct: number
    incorrect: number
    longestStreak: number
    durationMs: number
    mistakes: MistakeRecord[]
    listNames: string[]
}

export interface ListSelectionByHsk {
    kind: 'hsk'
    level: HskLevel
    includeLower: boolean
}

export interface ListSelectionByRank {
    kind: 'junda'
    maxRank: number
}

export type ListSelection = ListSelectionByHsk | ListSelectionByRank

export interface SessionConfig {
    /** Fixed for the whole session: the variety cannot change mid-session. */
    language: Language
    selection: ListSelection
    length: SessionLength
    optionCount: number
    pinyinDisplay: PinyinDisplay
    characterSet: CharacterSet
    /** Which romanisation is shown, e.g. Tai-lo rather than POJ. */
    romanization: RomanizationScheme
    /** Question types the player left switched on when the session started. */
    objectives: Objective[]
}

export interface StoredSession {
    id: string
    /** Which variety this session drilled, so history can be filtered by it. */
    language: Language
    startedAt: number
    finishedAt: number
    summary: SessionSummary
}

/* ------------------------------------------------------------------ settings */

export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * The choices that only mean something for one variety.
 *
 * Kept per language rather than globally so switching varieties cannot clobber the other's:
 * setting Taiwanese to Traditional must not change the Mandarin script choice, and a
 * Tai-lo-versus-POJ preference has no meaning for Mandarin at all.
 */
export interface LanguageSettings {
    selection: ListSelection
    characterSet: CharacterSet
    romanization: RomanizationScheme
    /**
     * Which question types to ask, out of `ALL_OBJECTIVES`. Per variety because the contrast
     * objective only exists for Taiwanese, so a shared set would offer a Mandarin player a
     * switch that could never do anything.
     */
    objectives: Objective[]
}

export interface Settings {
    schemaVersion: number
    /** The variety being practised. A session captures this, so it cannot change mid-session. */
    language: Language
    byLanguage: Record<Language, LanguageSettings>
    length: SessionLength
    optionCount: number
    pinyinDisplay: PinyinDisplay
    autoAdvance: boolean
    sound: boolean
    haptics: boolean
    theme: ThemePreference
}
