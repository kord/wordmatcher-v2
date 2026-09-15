import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '../../src/features/settings/SettingsScreen'
import type {
    CharacterSet,
    Language,
    RomanizationScheme,
    Settings,
} from '../../src/domain/types'
import { defaultSettings } from '../../src/storage/settings'

/**
 * The preview under the reading controls is the only place the app shows what a romanisation
 * choice does before you commit to a session, which makes it the one sample that has to follow
 * that choice.
 *
 * It has been wrong twice in the same direction. First it was hard-coded pinyin and stayed
 * pinyin when Taiwanese was selected, which also hid a missing tone colour for tones 5, 7 and
 * 8 - the sample never showed them. Then it was hard-coded Tâi-lô and stayed Tâi-lô when POJ
 * was selected, so choosing POJ looked like it did nothing. Both are the same defect: a
 * constant where the setting should have been read.
 */
const mocks = vi.hoisted(() => ({
    settings: { current: undefined as unknown as Settings },
    manifest: { current: null as unknown },
    speak: vi.fn(),
    tts: { available: true, fit: 'exact' as 'exact' | 'approximate' | null },
}))

vi.mock('../../src/app/router', () => ({
    useRoute: () => ({ navigate: vi.fn(), route: 'settings' }),
}))
vi.mock('../../src/content/useManifest', () => ({
    useManifest: () => ({ manifest: mocks.manifest.current, error: null }),
}))
vi.mock('../../src/features/session/SessionProvider', () => ({
    useSession: () => ({ quit: vi.fn() }),
}))
vi.mock('../../src/ui/hooks/useSettings', () => ({
    useSettings: () => ({ settings: mocks.settings.current, update: vi.fn() }),
}))
vi.mock('../../src/ui/hooks/useTts', () => ({
    useTts: () => ({
        available: mocks.tts.available,
        fit: mocks.tts.fit,
        speak: mocks.speak,
        cancel: vi.fn(),
        supported: true,
    }),
}))

/** The sample word is the same in every case, so it is found by its characters. */
function previewReading(): string {
    const han = screen.getByText(/花好月[圓圆]/)
    // The speaker button in the same row carries an aria-label too, so it is excluded.
    const labelled = han.parentElement?.querySelector('[aria-label]:not(button)')
    return labelled?.getAttribute('aria-label') ?? ''
}

/** The text of the "Speak the answer" row, description and all. */
function speechRowText(): string {
    const control = screen.getByRole('switch', { name: 'Speak the answer' })
    return control.parentElement?.textContent ?? ''
}

function renderSettings(
    language: Language,
    romanization: RomanizationScheme,
    { toneColours = false, characterSet = 'trad' as CharacterSet } = {},
) {
    const base = defaultSettings()
    mocks.settings.current = {
        ...base,
        language,
        pinyinDisplay: { ...base.pinyinDisplay, toneColours },
        byLanguage: {
            ...base.byLanguage,
            // Traditional unless a test needs otherwise, so the sample word is found by the
            // characters written above.
            [language]: { ...base.byLanguage[language], romanization, characterSet },
        },
    }
    render(<SettingsScreen />)
}

beforeEach(() => {
    mocks.settings.current = undefined as unknown as Settings
    mocks.speak.mockClear()
    mocks.tts.available = true
    mocks.tts.fit = 'exact'
})

describe('the reading preview follows the chosen scheme', () => {
    it('shows pinyin for Mandarin', () => {
        renderSettings('mandarin', 'pinyin')

        expect(previewReading()).toBe('huā hǎo yuè yuán')
    })

    it('shows Tâi-lô when Tâi-lô is chosen', () => {
        renderSettings('taiwanese', 'tailo')

        expect(previewReading()).toBe('hue-hó-gue̍h-guân')
    })

    it('shows POJ when POJ is chosen', () => {
        renderSettings('taiwanese', 'poj')

        expect(previewReading()).toBe('hoe-hó-goe̍h-goân')
    })

    it('keeps the sample on four different tones either way, so the palette gets exercised', () => {
        renderSettings('taiwanese', 'poj', { toneColours: true })
        const syllables = [...document.querySelectorAll('[data-tone]')].map((el) =>
            el.getAttribute('data-tone'),
        )

        expect(new Set(syllables).size).toBe(syllables.length)
        expect(syllables).toContain('5')
        expect(syllables).toContain('8')
    })
})

/**
 * The sample is also how a voice gets tested: the reading is on screen next to the speaker, so a
 * Mandarin voice reading Taiwanese gives itself away in one tap.
 */
describe('testing the voice on the sample word', () => {
    it('offers no button when there is no voice, rather than one that does nothing', () => {
        mocks.tts.available = false
        renderSettings('taiwanese', 'tailo')

        expect(screen.queryByRole('button', { name: 'Hear this word' })).toBeNull()
    })

    it('exists even with speech switched off, because that is when a voice gets auditioned', () => {
        renderSettings('taiwanese', 'tailo')

        expect(screen.getByRole('button', { name: 'Hear this word' })).toBeTruthy()
    })

    it('speaks the characters that are on screen', () => {
        renderSettings('taiwanese', 'tailo')
        fireEvent.click(screen.getByRole('button', { name: 'Hear this word' }))

        expect(mocks.speak).toHaveBeenCalledWith('花好月圓')
    })

    it('follows the character set, so it never speaks a word the player cannot see', () => {
        renderSettings('mandarin', 'pinyin', { characterSet: 'simp' })
        fireEvent.click(screen.getByRole('button', { name: 'Hear this word' }))

        expect(mocks.speak).toHaveBeenCalledWith('花好月圆')
    })

    it('names the fallback and its consequence when the voice is the wrong variety', () => {
        mocks.tts.fit = 'approximate'
        renderSettings('taiwanese', 'tailo')

        const text = speechRowText()
        expect(text).toMatch(/Mandarin voice/)
        expect(text).toMatch(/Min Nan/)
    })

    it('does not claim a fallback when the voice is the right one', () => {
        renderSettings('taiwanese', 'tailo')

        expect(speechRowText()).not.toMatch(/Min Nan/)
    })
})
