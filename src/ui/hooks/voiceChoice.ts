/**
 * Choosing a voice, and being honest about what the choice is worth.
 *
 * Split out of the hook so it can be tested against plain objects, because the cases that matter
 * most here are the ones a developer's machine will not have: a Min Nan voice installed, and no
 * Min Nan voice installed.
 */
import type { Language } from '../../domain/types'

/** The part of `SpeechSynthesisVoice` this needs, so a test can supply a literal. */
export interface VoiceLike {
    name: string
    lang: string
}

/**
 * Min Nan, i.e. Taiwanese Hokkien.
 *
 * The trap is the BCP-47 spelling `zh-min-nan`, which begins with `zh`: a test for Mandarin that
 * looks at the prefix files a Taiwanese voice as a Mandarin one, and it can then be chosen to
 * read Mandarin, which it does badly. So Min Nan is tested first and excluded from Mandarin.
 */
const MIN_NAN = /^(nan|zh[-_]min[-_]nan)([-_]|$)/i

const MANDARIN_PREFIX = /^(cmn|zh)([-_]|$)/i

export function isMinNan(lang: string): boolean {
    return MIN_NAN.test(lang)
}

export function isMandarin(lang: string): boolean {
    return !isMinNan(lang) && MANDARIN_PREFIX.test(lang)
}

/** Taiwan first, then any other region, since the app teaches the Taiwanese standard. */
const MIN_NAN_PREFERENCE = [/^nan[-_]tw/i, /^zh[-_]min[-_]nan[-_]tw/i, /^nan[-_]hant/i]

/** Mainland Mandarin first, then the other Mandarin locales, then anything. */
const MANDARIN_PREFERENCE = [/^zh[-_]cn$/i, /^zh[-_]hans/i, /^zh[-_]sg$/i, /^zh[-_]tw$/i, /^zh[-_]hant/i]

/**
 * The same, for the Taiwanese fallback, with the order reversed.
 *
 * The reading is going to be Mandarin either way, so this cannot make it correct - but Taiwan's
 * Mandarin carries the accent the learner is surrounded by, so it is the closer of two wrong
 * answers. It also puts this in the way of the mainland voice rather than the other way round.
 */
const MANDARIN_FALLBACK_PREFERENCE = [
    /^zh[-_]tw$/i,
    /^zh[-_]hant/i,
    /^zh[-_]cn$/i,
    /^zh[-_]hans/i,
    /^zh[-_]sg$/i,
]

function preferred<V extends VoiceLike>(
    voices: readonly V[],
    order: readonly RegExp[],
): V | null {
    for (const pattern of order) {
        const match = voices.find((voice) => pattern.test(voice.lang))
        if (match) return match
    }
    return voices[0] ?? null
}

export type VoiceFit = 'exact' | 'approximate'

export interface VoicePick<V> {
    voice: V | null
    /**
     * `exact` when the voice speaks the variety being practised, `approximate` when it does not.
     * The only approximation allowed is a Mandarin voice reading Taiwanese, which is worth having
     * because silence is worse - but it gives Taiwanese words their Mandarin readings, so the UI
     * says so rather than passing it off as the real thing.
     */
    fit: VoiceFit | null
}

/**
 * The best voice for a variety, or none.
 *
 * Mandarin never falls back to Min Nan: Mandarin voices are near-universal, and a Min Nan voice
 * reading Mandarin characters is a worse outcome than no speech at all. Taiwanese does fall back
 * to Mandarin, because a Taiwanese voice is genuinely hard to find and the alternative is that
 * the learner hears nothing.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], language: Language): VoicePick<V> {
    if (language === 'taiwanese') {
        const minNan = preferred(
            voices.filter((voice) => isMinNan(voice.lang)),
            MIN_NAN_PREFERENCE,
        )
        if (minNan) return { voice: minNan, fit: 'exact' }

        const mandarin = preferred(
            voices.filter((voice) => isMandarin(voice.lang)),
            MANDARIN_FALLBACK_PREFERENCE,
        )
        return mandarin ? { voice: mandarin, fit: 'approximate' } : { voice: null, fit: null }
    }

    const mandarin = preferred(voices.filter((voice) => isMandarin(voice.lang)), MANDARIN_PREFERENCE)
    return mandarin ? { voice: mandarin, fit: 'exact' } : { voice: null, fit: null }
}
