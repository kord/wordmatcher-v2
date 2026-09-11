import { applyToneMark, pinyinFromSyllables } from './pinyin'
import type { Rng } from './rng'
import { shuffle } from './rng'
import type { Pinyin, PinyinSyllable, Tone } from './types'

const TONES: Tone[] = [1, 2, 3, 4, 0]

export interface SyntheticPinyinInput {
    answer: Pinyin
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
 */
export function syntheticPinyinOptions(input: SyntheticPinyinInput): Pinyin[] {
    const { answer, count, taken, rng } = input
    const syllables = answer.syllables

    if (count <= 0 || syllables.length === 0) return []

    const seen = new Set(taken)
    const results: Pinyin[] = []

    const consider = (candidate: PinyinSyllable[]): void => {
        if (results.length >= count) return

        const pinyin = pinyinFromSyllables(candidate)
        const key = `pinyin:${pinyin.marked}`
        if (pinyin.marked === answer.marked || seen.has(key)) return

        seen.add(key)
        results.push(pinyin)
    }

    // One syllable's tone at a time.
    const toneVariants: PinyinSyllable[][] = []
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
    const reorderVariants: PinyinSyllable[][] = []
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
