export type Rng = () => number

/**
 * Small, fast, seedable PRNG. The scheduler is a probabilistic system, so being
 * able to reproduce a sequence in tests matters more than cryptographic quality.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Weighted random choice. Weights are treated as relative, not normalised. */
export function pickWeighted<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rng: Rng,
): T | undefined {
  if (items.length === 0) return undefined

  let total = 0
  for (const item of items) total += Math.max(0, weightOf(item))

  if (total <= 0) return items[Math.floor(rng() * items.length)]

  let threshold = rng() * total
  for (const item of items) {
    threshold -= Math.max(0, weightOf(item))
    if (threshold <= 0) return item
  }

  return items[items.length - 1]
}

/** Fisher-Yates, in place. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = items[i]
    items[i] = items[j]
    items[j] = swap
  }
  return items
}
