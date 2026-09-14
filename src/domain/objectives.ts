import { CONTRAST_OBJECTIVE, OBJECTIVES } from './constants'
import type { Rng } from './rng'
import { pickWeighted } from './rng'
import type { Objective, WordEntry } from './types'

/**
 * The objectives this word can actually be asked.
 *
 * The contrast objective needs a Mandarin counterpart whose characters differ - where they are
 * the same the prompt and the answer would be the same string, which is not a question. That is
 * a minority of Taiwanese words (72% of HSK 1 shares its characters with Mandarin, differing
 * only in reading), so this filter is what keeps the drill honest rather than the pool large.
 */
export function objectivesFor(entry: WordEntry): readonly Objective[] {
    return entry.mandarin?.differs === 'word' ? [...OBJECTIVES, CONTRAST_OBJECTIVE] : OBJECTIVES
}

/**
 * Which question type to ask. Weights are currently uniform, but routing this
 * through one function leaves room for per-objective tuning (for example
 * down-weighting a mode the player keeps failing).
 */
export function chooseObjective(rng: Rng, entry: WordEntry): Objective {
    return pickWeighted(objectivesFor(entry), () => 1, rng) ?? 'zh-en'
}
