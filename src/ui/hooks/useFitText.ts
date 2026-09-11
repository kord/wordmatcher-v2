import { useCallback, useEffect, useRef, useState } from 'react'

export interface FitTextOptions {
  max: number
  min: number
  /** Extra breathing room, in CSS pixels. */
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

export function useFitText<T extends HTMLElement>(text: string, options: FitTextOptions) {
  const { max, min, tolerance = 1 } = options
  const elementRef = useRef<T | null>(null)
  const [fontSize, setFontSize] = useState<number | null>(null)

  const measure = useCallback(() => {
    const element = elementRef.current
    if (!element) return

    const box = availableBox(element)
    const boxWidth = box ? box.width : element.clientWidth
    const boxHeight = box ? box.height : element.clientHeight
    if (boxWidth <= 0 || boxHeight <= 0) return

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

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => measure())
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    return () => observer.disconnect()
  }, [measure])

  return { ref, fontSize }
}
