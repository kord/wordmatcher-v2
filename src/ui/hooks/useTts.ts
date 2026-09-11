import { useCallback, useEffect, useMemo } from 'react'

/**
 * Browser speech synthesis. No audio assets, no download cost, and Mandarin
 * voices are present on iOS, Android, Windows and macOS.
 */
export function useTts() {
  const supported = useMemo(
    () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined',
    [],
  )

  const speak = useCallback(
    (text: string, lang = 'zh-CN') => {
      if (!supported || !text) return
      // Cancel first: rapid taps otherwise queue up a backlog of utterances.
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = 0.85
      utterance.pitch = 1
      speechSynthesis.speak(utterance)
    },
    [supported],
  )

  const cancel = useCallback(() => {
    if (supported) speechSynthesis.cancel()
  }, [supported])

  useEffect(() => cancel, [cancel])

  return { speak, cancel, supported }
}
