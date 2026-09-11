import { useCallback, useEffect, useRef, useState } from 'react'

export interface FitTextOptions {
  max: number
  min: number
  /** Extra breathing room, in CSS pixels. */
  tolerance?: number
}

/**
 * Shrink text until it fits its box.
 *
 * The previous implementation measured every option with a fresh canvas on every
 * render. This measures with a binary search instead, only when the text or the
 * box size changes, and caches the result per text/size pair.
 */
const cache = new Map<string, number>()

const MEASURE_STEPS = 11

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

    const width = element.clientWidth
    const height = element.clientHeight
    if (width === 0 || height === 0) return

    const cacheKey = `${text}|${width}x${height}|${max}|${min}`
    const cached = cache.get(cacheKey)
    if (cached !== undefined) {
      element.style.fontSize = `${cached}px`
      setFontSize(cached)
      return
    }

    const fits = (size: number): boolean => {
      element.style.fontSize = `${size}px`
      return (
        element.scrollWidth <= element.clientWidth + tolerance &&
        element.scrollHeight <= element.clientHeight + tolerance
      )
    }

    let low = min
    let high = max
    let best = min

    // Binary search for the largest size that still fits.
    for (let i = 0; i < MEASURE_STEPS; i++) {
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

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => measure())
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure])

  return { ref, fontSize }
}
