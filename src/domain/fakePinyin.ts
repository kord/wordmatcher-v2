import { applyToneMark, romanizationFromSyllables } from './pinyin'
import type { Rng } from './rng'
import { shuffle } from './rng'
import type { Romanization, RomanizationSyllable, Tone } from './types'

const TONES: Tone[] = [1, 2, 3, 4, 0]

export interface SyntheticPinyinInput {
    answer: Romanization
    /** How many extra readings to produce. */
    count: number
    /** Face keys already on screen; a synthetic reading must never duplicate one. */
    taken: ReadonlySet<string>
    rng: Rng
}

/**
 * Invent wrong readings that keep the answer's syllable count.
 *
 * Two sources, both of which preserve the syllable count by construction:
 *  - changing one syllable's tone (the classic learner error, and the most
 *    instructive distractor for a tone-based language), and
 *  - reordering the answer's own syllables.
 *
 * Real syllable shapes are kept throughout, so the options look like plausible
 * readings and the number of syllables can never give the answer away.
 *
 * **Pinyin only.** The tone marks are applied with pinyin's placement rules, which are not
 * Tai-lo's, so a Tai-lo reading put through this would come back misspelled. Taiwanese
 * questions draw their wrong answers from the pool instead; see `buildQuestion`.
 */
export function syntheticPinyinOptions(input: SyntheticPinyinInput): Romanization[] {
    const { answer, count, taken, rng } = input
    const syllables = answer.syllables

    if (count <= 0 || syllables.length === 0) return []

    const seen = new Set(taken)
    const results: Romanization[] = []

    const consider = (candidate: RomanizationSyllable[]): void => {
        if (results.length >= count) return

        const romanization = romanizationFromSyllables(candidate, answer.scheme)
        const key = `romanization:${romanization.marked}`
        if (romanization.marked === answer.marked || seen.has(key)) return

        seen.add(key)
        results.push(romanization)
    }

    // One syllable's tone at a time.
    const toneVariants: RomanizationSyllable[][] = []
    syllables.forEach((syllable, index) => {
        if (!syllable.han) return
        for (const tone of TONES) {
            if (tone === syllable.tone) continue
            const next = [...syllables]
            next[index] = { ...syllable, tone, marked: applyToneMark(syllable.base, tone) }
            toneVariants.push(next)
        }
    })

    // Reorderings keep every syllable real, so they always read plausibly.
    const reorderVariants: RomanizationSyllable[][] = []
    if (syllables.length >= 2) {
        reorderVariants.push([...syllables].reverse())
        for (let index = 0; index < syllables.length - 1; index++) {
            const next = [...syllables]
            const swap = next[index]
            next[index] = next[index + 1]
            next[index + 1] = swap
            reorderVariants.push(next)
        }
    }

    // Interleave the two families so a session gets a mix of error types rather
    // than all the tone swaps followed by all the reorderings.
    const pools = [shuffle(toneVariants, rng), shuffle(reorderVariants, rng)]
    let cursor = 0

    while (results.length < count && pools.some((pool) => pool.length > 0)) {
        const pool = pools[cursor % pools.length]
        const next = pool.shift()
        if (next) consider(next)
        cursor++
    }

    // Last resort for a single-syllable answer with too few usable tones (e.g. a
    // neutral-tone syllable): nothing more can be done without a wider pool.
    return results
}
