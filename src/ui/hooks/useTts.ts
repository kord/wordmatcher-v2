import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Browser speech synthesis. No audio assets, no download cost, and Mandarin
 * voices are present on iOS, Android, Windows and macOS.
 *
 * The catch: a device with no Chinese voice still reports a *successful*
 * utterance (`start` → `end`, no error) while an English voice tries and fails
 * to read Chinese characters, so the result is silence. There is no way to
 * detect that after the fact, which is why we resolve a voice up front and
 * expose `available` so callers can hide the controls instead of offering a
 * button that does nothing.
 */

/** Any Chinese voice is more useful than none. */
const ANY_CHINESE = /^(zh|cmn)/i

/** Mainland Mandarin first, then the other Mandarin locales, then anything. */
const PREFERRED_LANGS = [/^zh[-_]cn$/i, /^zh[-_]hans/i, /^zh[-_]sg$/i, /^zh[-_]tw$/i, /^zh[-_]hant/i]

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const chinese = voices.filter((voice) => ANY_CHINESE.test(voice.lang))
    for (const pattern of PREFERRED_LANGS) {
        const match = chinese.find((voice) => pattern.test(voice.lang))
        if (match) return match
    }
    return chinese[0] ?? null
}

export interface Tts {
    speak: (text: string, lang?: string) => void
    cancel: () => void
    /** The browser exposes the speech synthesis API at all. */
    supported: boolean
    /** A Chinese voice is installed, so speech will actually be intelligible. */
    available: boolean
}

export function useTts(): Tts {
    const supported = useMemo(
        () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined',
        [],
    )

    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
        supported ? speechSynthesis.getVoices() : [],
    )

    // getVoices() is empty until the engine has loaded its list, and
    // `voiceschanged` is the only reliable signal that it has.
    useEffect(() => {
        if (!supported) return
        const refresh = () => setVoices(speechSynthesis.getVoices())
        refresh()
        speechSynthesis.onvoiceschanged = refresh
        // Belt and braces: if the event already fired before mount, poll once.
        const retry = window.setTimeout(refresh, 300)
        return () => {
            window.clearTimeout(retry)
            speechSynthesis.onvoiceschanged = null
        }
    }, [supported])

    const voice = useMemo(() => pickVoice(voices), [voices])

    // Safari can garbage-collect an utterance mid-speech if nothing holds it.
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

    const speak = useCallback(
        (text: string, lang = 'zh-CN') => {
            if (!supported || !text || !voice) return
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.voice = voice
            utterance.lang = voice.lang || lang
            utterance.rate = 0.85
            utterance.pitch = 1
            utteranceRef.current = utterance

            if (speechSynthesis.speaking || speechSynthesis.pending) {
                // Chrome drops an utterance queued in the same tick as cancel(),
                // so let the queue drain first. This path is only for rapid
                // repeats, where a missed gesture context does not matter.
                speechSynthesis.cancel()
                window.setTimeout(() => speechSynthesis.speak(utterance), 0)
            } else {
                speechSynthesis.speak(utterance)
            }
        },
        [supported, voice],
    )

    const cancel = useCallback(() => {
        utteranceRef.current = null
        if (supported) speechSynthesis.cancel()
    }, [supported])

    useEffect(() => cancel, [cancel])

    return { speak, cancel, supported, available: supported && voice !== null }
}
