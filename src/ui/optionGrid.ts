import { REFERENCE_FONT_SIZE } from './textMetrics'

/**
 * Grid geometry for the answer options.
 *
 * The rule the layout follows: choose the column count that lets the text stay
 * as large as possible, and prefer the wider grid on a tie. For four short
 * Chinese words the 2x2 grid wins because taller boxes allow bigger glyphs; for
 * four English glosses a single column wins because halving the width would
 * shrink the text far more than the extra height gains.
 *
 * This module is pure: the caller supplies measurements, so it can be tested
 * without a browser.
 */
export interface GridPlanInput {
    /** How many options are on screen. */
    count: number
    /** Width of each option's text at REFERENCE_FONT_SIZE. */
    widthsAtReference: number[]
    /**
     * Width of every breakable unit of each option at REFERENCE_FONT_SIZE, in
     * order. A Latin word cannot be split across lines, while Chinese text can
     * break between any two characters. Omit to treat each text as unbreakable.
     */
    unitWidthsAtReference?: number[][]
    /** Width of a single space at REFERENCE_FONT_SIZE. */
    spaceWidthAtReference?: number
    /** Width available to the options grid, in px. */
    gridWidth: number
    /** Height shared between the prompt and the options, in px. */
    sharedHeight: number
    /** Row/column gap, in px. */
    gap: number
    /** Row-equivalents of the shared height the prompt should claim. */
    promptUnits: number
    /** Horizontal padding inside an option box, in px. */
    insetX: number
    /** Vertical padding inside an option box, in px. */
    insetY: number
    /** Line height as a multiple of the font size. */
    lineHeight: number
    minFontSize: number
    maxFontSize: number
}

export interface GridPlan {
    columns: number
    rows: number
    /** Largest font size this layout can show, in px. */
    fontSize: number
    promptFlex: number
    optionsFlex: number
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

/**
 * How many option-rows' worth of the shared height the prompt should claim.
 *
 * A one- or three-character prompt deserves the lion's share of the space and
 * will scale up to fill it; a long English gloss needs proportionally less.
 */
export function promptRowUnits(promptLength: number): number {
    return clamp(3.4 - 0.22 * promptLength, 1.5, 3.4)
}

/** Column counts worth considering for a given number of options. */
export function candidateColumns(count: number): number[] {
    return [1, 2, 3].filter((columns) => columns <= count && (columns < 3 || count % 3 === 0))
}

/**
 * Lines the browser's greedy wrapping would produce for these units.
 *
 * Estimating this as `ceil(totalWidth / usableWidth)` is not good enough: greedy
 * wrapping wastes space at the end of each line, so it can need more lines than
 * that, which is how an option ends up spilling out of its box in landscape.
 */
function greedyLineCount(units: readonly number[], usableWidth: number, space: number): number {
    let lines = 1
    let used = 0

    for (const width of units) {
        const addition = used === 0 ? width : space + width
        if (used + addition <= usableWidth + 1e-6) {
            used += addition
        } else {
            lines += 1
            used = width
        }
    }

    return lines
}

/**
 * Can every option be shown at `size` without spilling out of its box?
 *
 * Text wraps, so a long option uses more lines rather than shrinking. A line can
 * never be narrower than the widest unbreakable unit, which is what stops a long
 * Latin word from being modelled as if it could break in half.
 */
function fitsAt(input: GridPlanInput, size: number, boxWidth: number, boxHeight: number): boolean {
    const usableWidth = boxWidth - input.insetX
    const usableHeight = boxHeight - input.insetY
    if (usableWidth <= 0 || usableHeight <= 0) return false

    const scale = size / REFERENCE_FONT_SIZE
    const space = (input.spaceWidthAtReference ?? 0) * scale

    for (let index = 0; index < input.widthsAtReference.length; index++) {
        const units = input.unitWidthsAtReference?.[index]
        const scaled = units
            ? units.map((width) => width * scale)
            : [input.widthsAtReference[index] * scale]

        if (scaled.length === 0) continue

        // An unbreakable unit that is wider than the box can never fit.
        if (Math.max(...scaled) > usableWidth + 1e-6) return false

        const lines = greedyLineCount(scaled, usableWidth, space)
        if (lines * input.lineHeight * size > usableHeight + 1e-6) return false
    }

    return true
}

/** The largest font size that fits every text into the boxes this layout makes. */
export function evaluateGrid(input: GridPlanInput, columns: number): GridPlan {
    const rows = Math.ceil(input.count / columns)

    // Split the shared height between the prompt and the options in proportion to
    // their row counts, so a compact options grid leaves more room for the prompt.
    const optionsHeight = (input.sharedHeight * rows) / (rows + input.promptUnits)
    const boxWidth = (input.gridWidth - input.gap * (columns - 1)) / columns
    const boxHeight = (optionsHeight - input.gap * (rows - 1)) / rows

    const base = { columns, rows, promptFlex: input.promptUnits, optionsFlex: rows }

    // Scan down from the ceiling. The step granularity is finer than the eye can
    // see, and this is pure arithmetic over at most a handful of options.
    for (let size = input.maxFontSize; size > input.minFontSize; size -= 0.5) {
        if (fitsAt(input, size, boxWidth, boxHeight)) {
            return { ...base, fontSize: size }
        }
    }

    return { ...base, fontSize: input.minFontSize }
}

/** Every candidate layout, best first: largest text wins, then the wider grid. */
export function gridCandidates(input: GridPlanInput): GridPlan[] {
    return candidateColumns(input.count)
        .map((columns) => evaluateGrid(input, columns))
        .sort((a, b) => b.fontSize - a.fontSize || b.columns - a.columns)
}

export function planOptionGrid(input: GridPlanInput): GridPlan {
    return gridCandidates(input)[0]
}
