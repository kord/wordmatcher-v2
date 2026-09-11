import { useCallback, useEffect, useRef, useState } from 'react'

export interface FitTextOptions {
    max: number
    min: number
    /**
     * Extra breathing room, in CSS pixels. Keep it below 1: the reported scroll
     * size is an integer, so a whole pixel of slack accepts text that is
     * genuinely a pixel too wide.
     */
    tolerance?: number
}

/**
 * Shrink (or grow) text until it fits the box it sits in.
 *
 * The measurement is taken against the *container's* content box, not the text
 * element's own box. A text element hugs its content, so its own `clientHeight`
 * always equals its `scrollHeight` and the height check could never fail - which
 * silently capped Latin prompts at about 25px because a font's ink is taller
 * than a 1.15 line box, and let long Chinese prompts wrap and spill out.
 *
 * Results are cached per text and box size, so this runs only when the question
 * or the box changes, never once per frame.
 */
const cache = new Map<string, number>()

const MEASURE_STEPS = 11
/** Stop the cache growing without bound over a long session. */
const CACHE_LIMIT = 400

function pixels(value: string): number {
    return Number.parseFloat(value) || 0
}

/** Content box of the element's parent, which is what the text must fit into. */
function availableBox(element: HTMLElement): { width: number; height: number } | null {
    const parent = element.parentElement
    if (!parent) return null

    const style = getComputedStyle(parent)
    return {
        width: parent.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight),
        height: parent.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom),
    }
}

export function clearFitTextCache(): void {
    cache.clear()
}

/**
 * A font's own box (ascender + descender) is usually taller than the line box it
 * is asked to sit in - Segoe UI measures 1.33em against `.promptText`'s 1.15em
 * line-height. That surplus is split evenly above and below every line, so it
 * hangs off the top of the first line and the bottom of the last, and the
 * descenders live in the part below. An element is only `lines x line-height`
 * tall, so without budgeting for the surplus the ink is painted outside the box.
 */
const fontBoxRatios = new Map<string, number>()

/** The font's box in em, cached per family/weight/style. */
function fontBoxEm(style: CSSStyleDeclaration): number {
    const key = `${style.fontStyle}|${style.fontWeight}|${style.fontFamily}`
    const cached = fontBoxRatios.get(key)
    if (cached !== undefined) return cached

    const reference = 100
    const context = document.createElement('canvas').getContext('2d')
    let ratio = 1

    if (context) {
        context.font = `${style.fontStyle} ${style.fontWeight} ${reference}px ${style.fontFamily}`
        const metrics = context.measureText('Hxg')
        const ascent = Number.isFinite(metrics.fontBoundingBoxAscent)
            ? metrics.fontBoundingBoxAscent
            : metrics.actualBoundingBoxAscent
        const descent = Number.isFinite(metrics.fontBoundingBoxDescent)
            ? metrics.fontBoundingBoxDescent
            : metrics.actualBoundingBoxDescent
        if (Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0) {
            ratio = (ascent + descent) / reference
        }
    }

    fontBoxRatios.set(key, ratio)
    return ratio
}

export function useFitText<T extends HTMLElement>(text: string, options: FitTextOptions) {
    // Half a pixel rather than a whole one: `scrollWidth`/`scrollHeight` are
    // integers, so a tolerance of 1 accepted text that was genuinely a pixel too
    // wide, and the old `overflow: hidden` sliced that off the right edge.
    const { max, min, tolerance = 0.5 } = options
    const elementRef = useRef<T | null>(null)
    const [fontSize, setFontSize] = useState<number | null>(null)

    const measure = useCallback(() => {
        const element = elementRef.current
        if (!element) return

        const box = availableBox(element)
        const boxWidth = box ? box.width : element.clientWidth
        const boxHeight = box ? box.height : element.clientHeight
        if (boxWidth <= 0 || boxHeight <= 0) return

        // How far the ink reaches past the line boxes, in em. Zero for fonts
        // whose box fits inside the line-height (most CJK faces), so Chinese
        // prompts keep their full size and nothing is reserved needlessly.
        const style = getComputedStyle(element)
        const lineHeightPx = Number.parseFloat(style.lineHeight)
        const fontSizePx = Number.parseFloat(style.fontSize)
        const lineHeightEm =
            Number.isFinite(lineHeightPx) && fontSizePx > 0 ? lineHeightPx / fontSizePx : 1.15
        const inkSlackEm = Math.max(0, fontBoxEm(style) - lineHeightEm)

        // Pad the bottom of the box by the surplus. Only the bottom needs it: the
        // font's ascent metric already clears any ascender, including pinyin tone
        // marks, so nothing pokes above the line box. Padding in `em` scales with
        // the candidate size, so `scrollHeight` carries the reserve already and
        // the comparison below needs no extra term. Done before the cache lookup
        // so a cache hit is still correct on a freshly mounted element. Rounded,
        // so the value read back matches and the resize observer settles.
        const reserveEm = Math.round((inkSlackEm / 2) * 1000) / 1000
        if (Number.parseFloat(element.style.paddingBottom) !== reserveEm) {
            element.style.paddingBottom = `${reserveEm}em`
            element.style.paddingTop = ''
        }

        const cacheKey = `${text}|${boxWidth}x${boxHeight}|${max}|${min}`
        const cached = cache.get(cacheKey)
        if (cached !== undefined) {
            element.style.fontSize = `${cached}px`
            setFontSize(cached)
            return
        }

        const fits = (size: number): boolean => {
            element.style.fontSize = `${size}px`
            return (
                element.scrollWidth <= boxWidth + tolerance &&
                element.scrollHeight <= boxHeight + tolerance
            )
        }

        let low = min
        let high = max
        let best = min

        // Binary search for the largest size that still fits.
        for (let step = 0; step < MEASURE_STEPS; step++) {
            const mid = (low + high) / 2
            if (fits(mid)) {
                best = mid
                low = mid
            } else {
                high = mid
            }
        }

        // Round down a touch so sub-pixel differences cannot cause overflow.
        best = Math.max(min, Math.floor(best * 10) / 10)
        element.style.fontSize = `${best}px`
        if (cache.size > CACHE_LIMIT) cache.clear()
        cache.set(cacheKey, best)
        setFontSize(best)
    }, [max, min, text, tolerance])

    const ref = useCallback(
        (node: T | null) => {
            elementRef.current = node
            if (node) measure()
        },
        [measure],
    )

    useEffect(() => {
        const element = elementRef.current
        if (!element) return

        measure()

        // A web font - or the first CJK face to arrive on a phone - changes text
        // metrics after first paint, which would leave a size chosen against the
        // fallback. Re-measure once the fonts have settled.
        let cancelled = false
        void document.fonts.ready.then(() => {
            if (!cancelled) measure()
        })

        if (typeof ResizeObserver === 'undefined') {
            return () => {
                cancelled = true
            }
        }

        const observer = new ResizeObserver(() => measure())
        observer.observe(element)
        if (element.parentElement) observer.observe(element.parentElement)
        return () => {
            cancelled = true
            observer.disconnect()
        }
    }, [measure])

    return { ref, fontSize }
}
