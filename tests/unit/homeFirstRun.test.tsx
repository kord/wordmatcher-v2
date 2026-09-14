import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeScreen } from '../../src/features/home/HomeScreen'
import type { Settings } from '../../src/domain/types'
import { defaultSettings } from '../../src/storage/settings'

/**
 * The home screen is the whole first impression, so its wording is worth pinning down.
 *
 * The hooks are mocked rather than provided, because what is under test is what the screen says
 * and not how any of those providers work.
 */
const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    update: vi.fn(),
    start: vi.fn(async () => true),
    countSessions: vi.fn(async () => 0),
    settings: { current: undefined as unknown as Settings },
}))

vi.mock('../../src/app/router', () => ({
    useRoute: () => ({ navigate: mocks.navigate, route: 'home' }),
}))
vi.mock('../../src/content/useManifest', () => ({
    useManifest: () => ({ manifest: null, error: null }),
}))
vi.mock('../../src/features/session/SessionProvider', () => ({
    useSession: () => ({ start: mocks.start, phase: 'idle', error: null }),
}))
vi.mock('../../src/storage/sessionRepo', () => ({ countSessions: mocks.countSessions }))
vi.mock('../../src/ui/hooks/useSettings', () => ({
    useSettings: () => ({ settings: mocks.settings.current, update: mocks.update }),
}))

function renderHome(patch: Partial<Settings> = {}, sessions = 0) {
    mocks.countSessions.mockResolvedValue(sessions)
    mocks.settings.current = { ...defaultSettings(), ...patch }
    render(<HomeScreen />)
}

beforeEach(() => {
    mocks.countSessions.mockClear()
})

describe('before the first session', () => {
    it('says so, rather than offering an empty progress screen', async () => {
        renderHome({}, 0)

        await screen.findByRole('button', { name: 'Start your first session' })
        expect(screen.queryByRole('button', { name: 'Your progress' })).toBeNull()
        expect(screen.getByText(/Your progress will show up here afterwards/)).toBeTruthy()
    })

    it('is decided per variety, so Mandarin progress is not Taiwanese progress', async () => {
        renderHome({ language: 'taiwanese' }, 0)

        expect(mocks.countSessions).toHaveBeenCalledWith('taiwanese')
        await screen.findByRole('button', { name: 'Start your first session' })
    })
})

describe('once a session exists', () => {
    it('returns to the ordinary wording', async () => {
        renderHome({}, 3)

        await screen.findByRole('button', { name: 'Your progress' })
        expect(screen.getByRole('button', { name: 'Start session' })).toBeTruthy()
        expect(screen.queryByText(/Your progress will show up here afterwards/)).toBeNull()
    })
})

describe('what the screen promises', () => {
    it('leads with the task instead of the settings', () => {
        renderHome({}, 0)

        expect(screen.getByText('20 questions')).toBeTruthy()
        expect(screen.getByText('Tap the right answer.')).toBeTruthy()
    })

    it('explains the drill rather than opening with what happens when you get one wrong', () => {
        renderHome({}, 0)

        expect(screen.getByText(/Each one shows a word, its meaning or a reading/)).toBeTruthy()
    })

    it('frames the Taiwanese choice, which brings a second orthography with it', () => {
        renderHome({ language: 'taiwanese' }, 0)

        expect(screen.getByText(/Tâi-lô or POJ/)).toBeTruthy()
    })

    it('leaves Mandarin alone, because it carries no such choice', () => {
        renderHome({ language: 'mandarin' }, 0)

        expect(screen.queryByText(/Tâi-lô or POJ/)).toBeNull()
    })
})
