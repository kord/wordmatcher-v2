import { describe, expect, it } from 'vitest'
import {
    SETTINGS_KEY,
    defaultSettings,
    loadSettings,
    normalizeSettings,
    saveSettings,
    type StorageLike,
} from '../../src/storage/settings'

class FakeStorage implements StorageLike {
    private readonly map = new Map<string, string>()

    getItem(key: string): string | null {
        const value = this.map.get(key)
        return value === undefined ? null : value
    }

    setItem(key: string, value: string): void {
        this.map.set(key, value)
    }

    removeItem(key: string): void {
        this.map.delete(key)
    }

    set(key: string, value: string): void {
        this.map.set(key, value)
    }
}

describe('defaultSettings', () => {
    it('starts on HSK 1, simplified, diacritic pinyin, 20 rounds', () => {
        const settings = defaultSettings()

        expect(settings.language).toBe('mandarin')
        expect(settings.byLanguage.mandarin.selection).toEqual({
            kind: 'hsk',
            level: 1,
            includeLower: false,
        })
        expect(settings.byLanguage.mandarin.characterSet).toBe('simp')
        expect(settings.length).toEqual({ unit: 'rounds', value: 20 })
        expect(settings.optionCount).toBe(4)
        expect(settings.pinyinDisplay).toEqual({ style: 'diacritic', toneColours: false })
        expect(settings.autoAdvance).toBe(true)
        expect(settings.theme).toBe('system')
    })

    it('gives Taiwanese traditional characters and Tai-lo', () => {
        // Neither is a choice there: Taiwanese is never written in simplified characters
        // and is never romanised with pinyin.
        const { taiwanese } = defaultSettings().byLanguage

        expect(taiwanese.characterSet).toBe('trad')
        expect(taiwanese.romanization).toBe('tailo')
    })
})

describe('normalizeSettings', () => {
    it('falls back to defaults for junk input', () => {
        expect(normalizeSettings(null)).toEqual(defaultSettings())
        expect(normalizeSettings('nonsense')).toEqual(defaultSettings())
        expect(normalizeSettings({ optionCount: 'many' })).toEqual(defaultSettings())
    })

    it('keeps valid values', () => {
        const settings = normalizeSettings({
            language: 'mandarin',
            byLanguage: {
                mandarin: {
                    selection: { kind: 'hsk', level: 4, includeLower: true },
                    characterSet: 'trad',
                    romanization: 'pinyin',
                },
            },
            length: { unit: 'time', value: 300 },
            optionCount: 6,
            pinyinDisplay: { style: 'numbers', toneColours: true },
            autoAdvance: false,
            sound: false,
            haptics: false,
            theme: 'dark',
        })

        expect(settings.byLanguage.mandarin.selection).toEqual({
            kind: 'hsk',
            level: 4,
            includeLower: true,
        })
        expect(settings.byLanguage.mandarin.characterSet).toBe('trad')
        expect(settings.length).toEqual({ unit: 'time', value: 300 })
        expect(settings.optionCount).toBe(6)
        expect(settings.pinyinDisplay).toEqual({ style: 'numbers', toneColours: true })
        expect(settings.autoAdvance).toBe(false)
        expect(settings.sound).toBe(false)
        expect(settings.haptics).toBe(false)
        expect(settings.theme).toBe('dark')
    })

    it('keeps the two language buckets apart', () => {
        const settings = normalizeSettings({
            language: 'taiwanese',
            byLanguage: {
                mandarin: { characterSet: 'simp', romanization: 'pinyin' },
                taiwanese: { characterSet: 'trad', romanization: 'poj' },
            },
        })

        expect(settings.language).toBe('taiwanese')
        expect(settings.byLanguage.mandarin.characterSet).toBe('simp')
        expect(settings.byLanguage.taiwanese.romanization).toBe('poj')
    })

    it('rejects out-of-range and unknown values', () => {
        const settings = normalizeSettings({
            byLanguage: { mandarin: { selection: { kind: 'hsk', level: 99 } } },
            length: { unit: 'fortnights', value: 3 },
            optionCount: 99,
            pinyinDisplay: { style: 'wingdings' },
            theme: 'neon',
        })

        expect(settings.byLanguage.mandarin.selection).toEqual(
            defaultSettings().byLanguage.mandarin.selection,
        )
        expect(settings.length).toEqual(defaultSettings().length)
        expect(settings.optionCount).toBe(4)
        expect(settings.pinyinDisplay.style).toBe('diacritic')
        expect(settings.theme).toBe('system')
    })

    it('accepts a junda selection and rounds values', () => {
        const settings = normalizeSettings({
            byLanguage: { mandarin: { selection: { kind: 'junda', maxRank: 499.6 } } },
            length: { unit: 'rounds', value: 10.7 },
        })

        expect(settings.byLanguage.mandarin.selection).toEqual({ kind: 'junda', maxRank: 500 })
        expect(settings.length).toEqual({ unit: 'rounds', value: 11 })
    })
})

describe('save and load', () => {
    it('round-trips settings', () => {
        const storage = new FakeStorage()
        const settings = { ...defaultSettings(), theme: 'dark' as const, optionCount: 5 }

        saveSettings(settings, storage)
        expect(loadSettings(storage)).toEqual(settings)
    })

    it('recovers from a corrupt payload', () => {
        const storage = new FakeStorage()
        storage.set(SETTINGS_KEY, '{not json')

        expect(loadSettings(storage)).toEqual(defaultSettings())
    })

    it('ignores a stored schema version it does not recognise', () => {
        const storage = new FakeStorage()
        storage.set(SETTINGS_KEY, JSON.stringify({ schemaVersion: 99, optionCount: 7 }))

        // Unknown fields are dropped and known ones are still validated.
        expect(loadSettings(storage).optionCount).toBe(7)
        expect(loadSettings(storage).schemaVersion).toBe(1)
    })

    it('does not throw when storage rejects writes', () => {
        const hostile: StorageLike = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota exceeded')
            },
            removeItem: () => { },
        }

        expect(() => saveSettings(defaultSettings(), hostile)).not.toThrow()
    })
})
