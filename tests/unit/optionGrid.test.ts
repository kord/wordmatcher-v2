import { describe, expect, it } from 'vitest'
import {
  candidateColumns,
  gridCandidates,
  planOptionGrid,
  promptRowUnits,
  type GridPlanInput,
} from '../../src/ui/optionGrid'

/** Approximate rendered widths at REFERENCE_FONT_SIZE (100px). */
const ONE_HAN = 100
const THREE_HAN = 300
const GLOSS = 520

const HAN = [ONE_HAN, ONE_HAN, ONE_HAN, ONE_HAN]
const THREE_HAN_WORDS = [THREE_HAN, THREE_HAN, THREE_HAN, THREE_HAN]
const GLOSSES = [GLOSS, GLOSS, GLOSS, GLOSS]

function input(overrides: Partial<GridPlanInput> = {}): GridPlanInput {
  return {
    count: 4,
    widthsAtReference: THREE_HAN_WORDS,
    gridWidth: 440,
    sharedHeight: 600,
    gap: 8,
    promptUnits: 2.5,
    insetX: 24,
    insetY: 16,
    lineHeight: 1.15,
    minFontSize: 12,
    maxFontSize: 56,
    ...overrides,
  }
}

describe('promptRowUnits', () => {
  it('gives a short prompt more of the shared space than a long one', () => {
    expect(promptRowUnits(1)).toBeGreaterThan(promptRowUnits(6))
    expect(promptRowUnits(6)).toBeGreaterThan(promptRowUnits(30))
  })

  it('stays within sensible bounds', () => {
    expect(promptRowUnits(0)).toBeLessThanOrEqual(3.4)
    expect(promptRowUnits(1000)).toBeGreaterThanOrEqual(1.5)
  })
})

describe('candidateColumns', () => {
  it('considers one and two columns for the default four options', () => {
    expect(candidateColumns(4)).toEqual([1, 2])
  })

  it('adds three columns only when they divide the options evenly', () => {
    expect(candidateColumns(6)).toContain(3)
    expect(candidateColumns(5)).not.toContain(3)
  })

  it('never offers more columns than there are options', () => {
    expect(candidateColumns(2)).toEqual([1, 2])
    expect(candidateColumns(1)).toEqual([1])
  })
})

describe('planOptionGrid', () => {
  it('picks the 2x2 grid for single characters, where taller boxes allow bigger glyphs', () => {
    const plan = planOptionGrid(input({ widthsAtReference: HAN }))

    expect(plan.columns).toBe(2)
    expect(plan.rows).toBe(2)
  })

  it('picks a single column for long glosses, where halving the width would shrink them', () => {
    const plan = planOptionGrid(input({ widthsAtReference: GLOSSES }))

    expect(plan.columns).toBe(1)
    expect(plan.rows).toBe(4)
  })

  it('always returns the candidate with the largest text', () => {
    const cases = [HAN, THREE_HAN_WORDS, GLOSSES, [200, 200, 200, 200], [100, 520, 520, 520]]

    for (const widths of cases) {
      const candidates = gridCandidates(input({ widthsAtReference: widths }))
      const best = Math.max(...candidates.map((candidate) => candidate.fontSize))
      expect(candidates[0].fontSize).toBe(best)
    }
  })

  it('prefers the wider grid when layouts tie on text size', () => {
    // A low ceiling makes both layouts hit the same cap.
    const candidates = gridCandidates(
      input({ widthsAtReference: HAN, maxFontSize: 30, sharedHeight: 900 }),
    )
    const oneColumn = candidates.find((candidate) => candidate.columns === 1)
    const twoColumn = candidates.find((candidate) => candidate.columns === 2)

    expect(twoColumn?.fontSize).toBe(oneColumn?.fontSize)
    expect(candidates[0].columns).toBe(2)
  })

  it('shrinks the text rather than overflowing a short screen', () => {
    const tall = planOptionGrid(input({ widthsAtReference: GLOSSES, sharedHeight: 640 }))
    const short = planOptionGrid(input({ widthsAtReference: GLOSSES, sharedHeight: 300 }))

    expect(short.fontSize).toBeLessThan(tall.fontSize)
    expect(short.fontSize).toBeGreaterThanOrEqual(12)
  })

  it('gives the options more of the space when they need more rows', () => {
    const single = planOptionGrid(input({ widthsAtReference: GLOSSES }))
    const double = planOptionGrid(input({ widthsAtReference: HAN }))

    expect(single.optionsFlex).toBeGreaterThan(double.optionsFlex)
    expect(single.promptFlex).toBe(double.promptFlex)
  })

  it('lets a short prompt claim more space than a long one', () => {
    // A high ceiling keeps the font from being capped, so the space split shows.
    const shortPrompt = planOptionGrid(
      input({ promptUnits: promptRowUnits(1), maxFontSize: 200 }),
    )
    const longPrompt = planOptionGrid(
      input({ promptUnits: promptRowUnits(20), maxFontSize: 200 }),
    )

    expect(shortPrompt.promptFlex).toBeGreaterThan(longPrompt.promptFlex)
    // A bigger prompt share leaves the options less room, so their text is smaller.
    expect(shortPrompt.fontSize).toBeLessThan(longPrompt.fontSize)
  })

  it('handles a degenerate box without producing nonsense', () => {
    const plan = planOptionGrid(input({ gridWidth: 0, sharedHeight: 0 }))

    expect(plan.fontSize).toBe(12)
    expect(plan.columns).toBeGreaterThanOrEqual(1)
  })

  it('returns a usable plan for a two-option question', () => {
    const plan = planOptionGrid(input({ count: 2, widthsAtReference: [THREE_HAN, THREE_HAN] }))

    expect(plan.columns).toBeGreaterThanOrEqual(1)
    expect(plan.columns).toBeLessThanOrEqual(2)
    expect(plan.optionsFlex).toBe(Math.ceil(2 / plan.columns))
  })

  it('scales the font up when the screen affords it', () => {
    const roomy = planOptionGrid(
      input({ widthsAtReference: HAN, sharedHeight: 900, maxFontSize: 200 }),
    )
    const cramped = planOptionGrid(input({ widthsAtReference: HAN, sharedHeight: 400 }))

    expect(roomy.fontSize).toBeGreaterThan(cramped.fontSize)
  })
})
