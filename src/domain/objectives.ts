import { ALL_OBJECTIVES, OBJECTIVES } from './constants'
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
    return entry.mandarin?.differs === 'word' ? ALL_OBJECTIVES : OBJECTIVES
}

/**
 * The objectives this word can be asked *and* the player has left switched on.
 *
 * Falls back to everything the word can be asked when the two do not overlap at all. That is
 * not hypothetical: the contrast drill is one a player can leave on alone, and it needs a word
 * written differently from its Mandarin counterpart, so on the many words whose characters match
 * there would otherwise be no question to ask. Being asked something beats the session failing,
 * and the settings panel refuses to let the set be emptied in the first place - this is the
 * second line of defence, for a store edited by hand or written by an older build.
 *
 * The fallback is the word's own full set, not the universal four, so a player who has turned
 * the contrast drill off is never shown it by the fallback either.
 */
export function askableObjectives(
    entry: WordEntry,
    enabled?: readonly Objective[],
): readonly Objective[] {
    const askable = objectivesFor(entry)
    if (!enabled || enabled.length === 0) return askable

    const chosen = enabled.filter((objective) => askable.includes(objective))
    return chosen.length > 0 ? chosen : askable
}

/**
 * Which question type to ask. Weights are currently uniform, but routing this
 * through one function leaves room for per-objective tuning (for example
 * down-weighting a mode the player keeps failing).
 */
export function chooseObjective(
    rng: Rng,
    entry: WordEntry,
    enabled?: readonly Objective[],
): Objective {
    return pickWeighted(askableObjectives(entry, enabled), () => 1, rng) ?? 'zh-en'
}
