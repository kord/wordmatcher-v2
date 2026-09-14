import type { Objective, SessionLength } from './types'

export const MAX_BOX = 5

/**
 * Relative likelihood of drawing a word from each Leitner box (0 = weakest).
 * Weaker words are drawn far more often, but nothing is ever impossible.
 */
export const BOX_WEIGHTS = [10, 7, 4.5, 2.5, 1.4, 0.8]

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long a word rests once it lands in each box. Index === box. */
export const INTERVALS_MS = [
    1 * MINUTE, // 0 - just got it wrong or first exposure
    5 * MINUTE, // 1
    20 * MINUTE, // 2
    2 * HOUR, // 3
    1 * DAY, // 4
    4 * DAY, // 5
]

/** A missed word comes back quickly. */
export const WRONG_AGAIN_MS = 30_000

/** Correct answers in a row needed to move up a box. */
export const PROMOTE_STREAK = 2

/** How many recently shown words to avoid repeating. */
export const RECENT_EXCLUSION = 10

/** Multiplier applied to words that are not due yet, so nothing is unreachable. */
export const UNDUE_FLOOR = 0.08

/** Overdue-ness stops mattering after this many days. */
export const OVERDUE_CAP_DAYS = 3

/** Unseen words are boosted so new material keeps flowing in. */
export const NOVELTY_WEIGHT = 3

/** A missed word is re-asked once, this many questions later, within the session. */
export const REASK_DELAY_QUESTIONS = 8

/**
 * Objectives that every word can be asked, in any variety: they are expressed in terms of
 * surfaces, and every word has characters, a gloss and a reading.
 */
export const OBJECTIVES: Objective[] = ['zh-en', 'en-zh', 'zh-pinyin', 'pinyin-zh']

/**
 * Asked only of a Taiwanese word that is written differently from the Mandarin word for the
 * same thing. The question shows the Mandarin form the learner already knows and asks for the
 * Taiwanese one, which is the whole difficulty for a fluent Mandarin speaker starting out.
 *
 * Not in `OBJECTIVES` because it cannot be asked universally: a word with no Mandarin
 * counterpart has nothing to show as the prompt.
 */
export const CONTRAST_OBJECTIVE: Objective = 'zh-tw'

export const DEFAULT_OPTION_COUNT = 4
export const OPTION_COUNT_PRESETS = [3, 4, 5, 6]

export const ROUND_LENGTH_PRESETS = [10, 20, 30, 50]
export const TIME_LENGTH_PRESETS = [120, 300, 600]
export const JUN_DA_PRESETS = [100, 300, 500, 1000, 2000, 5000]

export const DEFAULT_LENGTH: SessionLength = { unit: 'rounds', value: 20 }
