import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Language } from '../../domain/types'
import { pickVoice, type VoiceFit } from './voiceChoice'

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
 *
 * The second catch is that a voice can be intelligible and still wrong. A Taiwanese voice is
 * rare, so Taiwanese falls back to a Mandarin voice - which reads 卵 as `luǎn` where the answer
 * is `nn̄g` - and `fit` reports that, so the UI can tell the player rather than letting them
 * learn the wrong pronunciation. See `voiceChoice.ts` for how a voice is chosen.
 */

export interface Tts {
    speak: (text: string, lang?: string) => void
    cancel: () => void
    /** The browser exposes the speech synthesis API at all. */
    supported: boolean
    /** A voice is installed, so speech will actually be intelligible. */
    available: boolean
    /**
     * `approximate` when the only voice available is the wrong variety - a Mandarin voice asked
     * to read Taiwanese - so the caller can say so. `null` when there is no voice.
     */
    fit: VoiceFit | null
}

/**
 * @param language the variety being practised, which decides which voice is wanted: a Min Nan
 * voice for Taiwanese, and never a Min Nan voice for Mandarin.
 */
export function useTts(language: Language): Tts {
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

    const pick = useMemo(() => pickVoice(voices, language), [voices, language])
    const voice = pick.voice

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
            // `volume` is the API's only loudness control and it is capped at 1, which is also
            // what leaving it unset gives. There is no headroom, so speech that sounds quiet is
            // the device's media volume rather than ours. Set it anyway: it is the one knob
            // there is, and a silent default cannot be told apart from a deliberate one.
            utterance.volume = 1
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

    return { speak, cancel, supported, available: supported && voice !== null, fit: pick.fit }
}
