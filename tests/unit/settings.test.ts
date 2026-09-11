import { describe, expect, it } from 'vitest'
import {
  LEGACY_IMPORT_FLAG,
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

/** Keys as written by the original Create React App version. */
function seedLegacy(storage: FakeStorage, values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) storage.set(`wm_options-${key}`, value)
}

describe('defaultSettings', () => {
  it('starts on HSK 1, simplified, diacritic pinyin, 20 rounds', () => {
    const settings = defaultSettings()

    expect(settings.selection).toEqual({ kind: 'hsk', level: 1, includeLower: false })
    expect(settings.length).toEqual({ unit: 'rounds', value: 20 })
    expect(settings.optionCount).toBe(4)
    expect(settings.pinyinDisplay).toEqual({ style: 'diacritic', toneColours: false })
    expect(settings.characterSet).toBe('simp')
    expect(settings.autoAdvance).toBe(true)
    expect(settings.theme).toBe('system')
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
      selection: { kind: 'hsk', level: 4, includeLower: true },
      length: { unit: 'time', value: 300 },
      optionCount: 6,
      pinyinDisplay: { style: 'numbers', toneColours: true },
      characterSet: 'trad',
      autoAdvance: false,
      sound: false,
      haptics: false,
      theme: 'dark',
    })

    expect(settings.selection).toEqual({ kind: 'hsk', level: 4, includeLower: true })
    expect(settings.length).toEqual({ unit: 'time', value: 300 })
    expect(settings.optionCount).toBe(6)
    expect(settings.pinyinDisplay).toEqual({ style: 'numbers', toneColours: true })
    expect(settings.characterSet).toBe('trad')
    expect(settings.autoAdvance).toBe(false)
    expect(settings.sound).toBe(false)
    expect(settings.haptics).toBe(false)
    expect(settings.theme).toBe('dark')
  })

  it('rejects out-of-range and unknown values', () => {
    const settings = normalizeSettings({
      selection: { kind: 'hsk', level: 99 },
      length: { unit: 'fortnights', value: 3 },
      optionCount: 99,
      pinyinDisplay: { style: 'wingdings' },
      theme: 'neon',
    })

    expect(settings.selection).toEqual(defaultSettings().selection)
    expect(settings.length).toEqual(defaultSettings().length)
    expect(settings.optionCount).toBe(4)
    expect(settings.pinyinDisplay.style).toBe('diacritic')
    expect(settings.theme).toBe('system')
  })

  it('accepts a junda selection and rounds values', () => {
    const settings = normalizeSettings({
      selection: { kind: 'junda', maxRank: 499.6 },
      length: { unit: 'rounds', value: 10.7 },
    })

    expect(settings.selection).toEqual({ kind: 'junda', maxRank: 500 })
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
      removeItem: () => {},
    }

    expect(() => saveSettings(defaultSettings(), hostile)).not.toThrow()
  })
})

describe('legacy settings import', () => {
  it('maps the old keys, correcting the broken "questions" duration', () => {
    const storage = new FakeStorage()
    seedLegacy(storage, {
      wordListType: 'HSK',
      hskLevel: '1002', // the old app offset HSK levels by 999
      includeLowerHskLevels: 'true',
      characterType: 'cn',
      gameDurationType: 'questions',
      gameDurationQuestions: '25',
    })

    const settings = loadSettings(storage)

    expect(settings.selection).toEqual({ kind: 'hsk', level: 3, includeLower: true })
    expect(settings.characterSet).toBe('simp')
    // The old app compared against 'rounds', so this silently became unlimited.
    expect(settings.length).toEqual({ unit: 'rounds', value: 25 })
    expect(storage.getItem(LEGACY_IMPORT_FLAG)).not.toBeNull()
  })

  it('maps a time duration and a Jun Da selection', () => {
    const storage = new FakeStorage()
    seedLegacy(storage, {
      wordListType: 'JunDa',
      jundaMax: '800',
      characterType: 'tw',
      gameDurationType: 'time',
      gameDurationTimeSeconds: '90',
    })

    const settings = loadSettings(storage)

    expect(settings.selection).toEqual({ kind: 'junda', maxRank: 800 })
    expect(settings.characterSet).toBe('trad')
    expect(settings.length).toEqual({ unit: 'time', value: 90 })
  })

  it('falls back to defaults when no legacy keys exist, and does not re-import', () => {
    const storage = new FakeStorage()
    expect(loadSettings(storage)).toEqual(defaultSettings())

    // A later legacy write must not be picked up once the import has run.
    seedLegacy(storage, { hskLevel: '1005' })
    expect(loadSettings(storage)).toEqual(defaultSettings())
  })

  it('prefers stored v2 settings over legacy keys', () => {
    const storage = new FakeStorage()
    seedLegacy(storage, { hskLevel: '1005' })
    saveSettings({ ...defaultSettings(), optionCount: 3 }, storage)

    expect(loadSettings(storage).optionCount).toBe(3)
    expect(loadSettings(storage).selection).toEqual({ kind: 'hsk', level: 1, includeLower: false })
  })
})
