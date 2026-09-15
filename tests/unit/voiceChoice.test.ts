import { describe, expect, it } from 'vitest'
import { isMandarin, isMinNan, pickVoice, type VoiceLike } from '../../src/ui/hooks/voiceChoice'

/**
 * Voice selection, tested against literals because the arrangement that matters most - a Min Nan
 * voice being available at all - is the one a developer's machine almost never has.
 *
 * The trap these exist for: Min Nan's BCP-47 tag is `zh-min-nan`, which begins with `zh`. A
 * Mandarin test that looks at the prefix files a Taiwanese voice as a Mandarin one, and it then
 * gets chosen to read Mandarin, which it does badly, while the Taiwanese it was wanted for still
 * falls back.
 */

const voice = (lang: string, name = lang): VoiceLike => ({ name, lang })

/** What a typical Windows or Android install actually offers. */
const MANDARIN_ONLY = [voice('en-GB'), voice('zh-CN', 'Huihui'), voice('zh-CN', 'Kangkang')]

const WITH_MIN_NAN = [...MANDARIN_ONLY, voice('nan-TW', 'Taiwanese'), voice('zh-TW', 'Yating')]

const ONLY_MIN_NAN = [voice('en-GB'), voice('zh-min-nan', 'Hokkien')]

const NOTHING = [voice('en-GB'), voice('ja-JP')]

describe('recognising the languages', () => {
    it('knows the two spellings of Min Nan and the two of Mandarin', () => {
        expect(isMinNan('nan')).toBe(true)
        expect(isMinNan('nan-TW')).toBe(true)
        expect(isMinNan('zh-min-nan')).toBe(true)
        expect(isMinNan('nan-Hant-TW')).toBe(true)

        expect(isMandarin('zh-CN')).toBe(true)
        expect(isMandarin('zh-TW')).toBe(true)
        expect(isMandarin('cmn-Hans-CN')).toBe(true)
    })

    it('never counts a Min Nan voice as Mandarin, whatever prefix it carries', () => {
        // The whole reason the check exists: `zh-min-nan` starts with `zh`.
        expect(isMandarin('zh-min-nan')).toBe(false)
        expect(isMandarin('nan-TW')).toBe(false)
    })

    it('does not mistake an unrelated language for either', () => {
        expect(isMinNan('en-GB')).toBe(false)
        expect(isMandarin('en-GB')).toBe(false)
        expect(isMandarin('japanese')).toBe(false)
    })
})

describe('Mandarin', () => {
    it('takes a Mandarin voice, and prefers the mainland one', () => {
        expect(pickVoice(MANDARIN_ONLY, 'mandarin')).toEqual({
            voice: voice('zh-CN', 'Huihui'),
            fit: 'exact',
        })
    })

    it('ignores a Min Nan voice even when that is all there is', () => {
        // A Min Nan voice reading Mandarin characters is worse than silence, and Mandarin voices
        // are near-universal, so there is nothing to fall back to.
        expect(pickVoice(ONLY_MIN_NAN, 'mandarin')).toEqual({ voice: null, fit: null })
    })

    it('reports nothing when there is no Chinese voice at all', () => {
        expect(pickVoice(NOTHING, 'mandarin')).toEqual({ voice: null, fit: null })
    })

    it('is never approximate, because it has nothing to approximate with', () => {
        expect(pickVoice(WITH_MIN_NAN, 'mandarin').fit).toBe('exact')
    })
})

describe('Taiwanese', () => {
    it('takes a Min Nan voice rather than the Mandarin ones, and calls it exact', () => {
        expect(pickVoice(WITH_MIN_NAN, 'taiwanese')).toEqual({
            voice: voice('nan-TW', 'Taiwanese'),
            fit: 'exact',
        })
    })

    it('finds a Min Nan voice tagged the `zh-min-nan` way', () => {
        expect(pickVoice(ONLY_MIN_NAN, 'taiwanese')).toEqual({
            voice: voice('zh-min-nan', 'Hokkien'),
            fit: 'exact',
        })
    })

    it('prefers the Taiwanese standard over another Min Nan region', () => {
        const voices = [voice('nan', 'Generic'), voice('nan-TW', 'Taiwanese')]

        expect(pickVoice(voices, 'taiwanese').voice).toEqual(voice('nan-TW', 'Taiwanese'))
    })

    it('falls back to a Mandarin voice, and says that is what it is doing', () => {
        // Worth having, because the alternative is that the learner hears nothing - but it gives
        // Taiwanese words their Mandarin readings, so the label has to be honest about it.
        expect(pickVoice(MANDARIN_ONLY, 'taiwanese')).toEqual({
            voice: voice('zh-CN', 'Huihui'),
            fit: 'approximate',
        })
    })

    it('prefers a Mandarin voice from Taiwan when there is no Min Nan one', () => {
        const voices = [voice('zh-CN', 'Huihui'), voice('zh-TW', 'Yating')]

        // Region is the only signal left once the variety is wrong, and Taiwan's Mandarin voice
        // is at least the right accent area.
        expect(pickVoice(voices, 'taiwanese').voice).toEqual(voice('zh-TW', 'Yating'))
    })

    it('reports nothing when there is no Chinese voice at all', () => {
        expect(pickVoice(NOTHING, 'taiwanese')).toEqual({ voice: null, fit: null })
    })
})
