import { OBJECTIVES } from './constants'
import type { Rng } from './rng'
import { pickWeighted } from './rng'
import type { Objective } from './types'

/**
 * Which question type to ask. Weights are currently uniform, but routing this
 * through one function leaves room for per-objective tuning (for example
 * down-weighting a mode the player keeps failing).
 */
export function chooseObjective(rng: Rng): Objective {
    return pickWeighted(OBJECTIVES, () => 1, rng) ?? 'zh-en'
}
