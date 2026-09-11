/**
 * Shared domain types.
 *
 * This module must stay dependency-free: it is imported by both the browser app
 * and the Node build-time data pipeline (`tools/build-data.ts`).
 */

/* ------------------------------------------------------------------ content */

export type Tone = 0 | 1 | 2 | 3 | 4

export interface PinyinSyllable {
  /** Syllable without tone marks, e.g. `ni`. */
  base: string
  /** Syllable with tone diacritics, e.g. `nǐ`. */
  marked: string
  /** 1-4 for real tones, 0 for neutral tone or a non-Chinese token. */
  tone: Tone
  /**
   * True when this syllable was produced from a Chinese character. False for
   * punctuation or Latin text that `pinyin-pro` passes through unchanged, so
   * renderers know not to attach a tone marker.
   */
  han: boolean
}

export interface Pinyin {
  /** Space separated tone-marked form: `nǐ hǎo`. */
  marked: string
  /** Space separated numbered form: `ni3 hao3`. */
  numbered: string
  syllables: PinyinSyllable[]
}

export interface Classifier {
  char: string
  /** Numbered pinyin exactly as it appears upstream, e.g. `ge4`. */
  pinyin: string
}

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface WordEntry {
  /** Stable across lists and rebuilds: hash of simplified form + tone-marked pinyin. */
  id: string
  simp: string
  trad: string
  pinyin: Pinyin
  /** Every sense, split on `;` and cleaned. */
  glosses: string[]
  /** First sense, used for compact answer options. */
  glossShort: string
  classifiers: Classifier[]
  listId: string
  hsk?: HskLevel
  /** Position in the Jun Da frequency list (1 = most frequent). */
  rank?: number
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

export type Objective = 'zh-en' | 'en-zh' | 'zh-pinyin' | 'pinyin-zh'

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

export type FaceKind = 'han' | 'gloss' | 'pinyin'

/** One rendered surface: characters, an English gloss, or pinyin. */
export interface QuestionFace {
  kind: FaceKind
  /** Plain text form, always populated (used for accessibility and speech). */
  text: string
  /** Present only when `kind` is 'pinyin'. */
  pinyin?: Pinyin
}

export interface QuestionOption {
  entry: WordEntry
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
  characterSet: CharacterSet

export interface ListSelectionByRank {
  kind: 'junda'
  maxRank: number
}

export type ListSelection = ListSelectionByHsk | ListSelectionByRank

export interface SessionConfig {
  selection: ListSelection
  length: SessionLength
  optionCount: number
  pinyinDisplay: PinyinDisplay
}

export interface StoredSession {
  id: string
  startedAt: number
  finishedAt: number
  summary: SessionSummary
}

/* ------------------------------------------------------------------ settings */

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Settings {
  schemaVersion: number
  selection: ListSelection
  length: SessionLength
  optionCount: number
  characterSet: CharacterSet
  pinyinDisplay: PinyinDisplay
  autoAdvance: boolean
  sound: boolean
  haptics: boolean
  theme: ThemePreference
}
