import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '../../src/features/settings/SettingsScreen'
import type { Language, RomanizationScheme, Settings } from '../../src/domain/types'
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
    useTts: () => ({ available: false }),
}))

/** The sample word is the same in every case, so it is found by its characters. */
function previewReading(): string {
    const han = screen.getByText('花好月圓')
    const row = han.parentElement
    const labelled = row?.querySelector('[aria-label]')
    return labelled?.getAttribute('aria-label') ?? ''
}

function renderSettings(
    language: Language,
    romanization: RomanizationScheme,
    toneColours = false,
) {
    const base = defaultSettings()
    mocks.settings.current = {
        ...base,
        language,
        pinyinDisplay: { ...base.pinyinDisplay, toneColours },
        byLanguage: {
            ...base.byLanguage,
            // Traditional, so the sample word is found by the characters written above.
            [language]: { ...base.byLanguage[language], romanization, characterSet: 'trad' },
        },
    }
    render(<SettingsScreen />)
}

beforeEach(() => {
    mocks.settings.current = undefined as unknown as Settings
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
        renderSettings('taiwanese', 'poj', true)
        const syllables = [...document.querySelectorAll('[data-tone]')].map((el) =>
            el.getAttribute('data-tone'),
        )

        expect(new Set(syllables).size).toBe(syllables.length)
        expect(syllables).toContain('5')
        expect(syllables).toContain('8')
    })
})
