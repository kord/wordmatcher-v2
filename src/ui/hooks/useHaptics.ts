import { useCallback } from 'react'

type Pattern = number | number[]

/**
 * Vibration is Android-only: iOS Safari does not implement `navigator.vibrate`.
 * Treat it as progressive enhancement rather than a cross-platform guarantee.
 */
export function useHaptics(enabled: boolean) {
  return useCallback(
    (pattern: Pattern) => {
      if (!enabled) return
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
      try {
        navigator.vibrate(pattern)
      } catch {
        // Some browsers throw when the page is not visible; ignore.
      }
    },
    [enabled],
  )
}
