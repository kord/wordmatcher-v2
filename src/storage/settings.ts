import { DEFAULT_LENGTH, DEFAULT_OPTION_COUNT } from '../domain/constants'
import type {
  HskLevel,
  ListSelection,
  PinyinStyle,
  SessionLength,
  Settings,
  ThemePreference,
} from '../domain/types'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const SETTINGS_KEY = 'wm2.settings'
export const LEGACY_IMPORT_FLAG = 'wm2.legacySettingsImported'
export const SETTINGS_SCHEMA_VERSION = 1

/** Keys written by the original Create React App version. */
const LEGACY = {
  wordListType: 'wm_options-wordListType',
  hskLevel: 'wm_options-hskLevel',
  jundaMax: 'wm_options-jundaMax',
  includeLowerHskLevels: 'wm_options-includeLowerHskLevels',
  characterSet: 'wm_options-characterType',
  durationType: 'wm_options-gameDurationType',
  durationQuestions: 'wm_options-gameDurationQuestions',
  durationSeconds: 'wm_options-gameDurationTimeSeconds',
} as const

export function defaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    selection: { kind: 'hsk', level: 1, includeLower: false },
    length: { ...DEFAULT_LENGTH },
    optionCount: DEFAULT_OPTION_COUNT,
    pinyinDisplay: { style: 'diacritic', toneColours: false },
    characterSet: 'simp',
    autoAdvance: true,
    sound: true,
    haptics: true,
    theme: 'system',
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function clampHskLevel(value: unknown): HskLevel | null {
  const level = Number(value)
  return level >= 1 && level <= 6 ? ((Math.round(level) as HskLevel) ?? null) : null
}

function asPinyinStyle(value: unknown): PinyinStyle | null {
  return value === 'diacritic' || value === 'numbers' || value === 'superscript' ? value : null
}

function asTheme(value: unknown): ThemePreference | null {
  return value === 'system' || value === 'light' || value === 'dark' ? value : null
}

function normalizeLength(value: unknown, fallback: SessionLength): SessionLength {
  if (typeof value !== 'object' || value === null) return fallback
  const candidate = value as { unit?: unknown; value?: unknown }
  const amount = Number(candidate.value)
  if (!Number.isFinite(amount) || amount <= 0) return fallback

  if (candidate.unit === 'rounds') return { unit: 'rounds', value: Math.round(amount) }
  if (candidate.unit === 'time') return { unit: 'time', value: Math.round(amount) }
  return fallback
}

function normalizeSelection(value: unknown, fallback: ListSelection): ListSelection {
  if (typeof value !== 'object' || value === null) return fallback
  const candidate = value as Record<string, unknown>

  if (candidate.kind === 'junda') {
    const maxRank = Number(candidate.maxRank)
    if (Number.isFinite(maxRank) && maxRank > 0) {
      return { kind: 'junda', maxRank: Math.round(maxRank) }
    }
    return fallback
  }

  if (candidate.kind === 'hsk') {
    const level = clampHskLevel(candidate.level)
    if (level !== null) {
      return { kind: 'hsk', level, includeLower: candidate.includeLower === true }
    }
  }

  return fallback
}

/** Defensive parse: anything unknown falls back to a default rather than throwing. */
export function normalizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings()
  if (typeof raw !== 'object' || raw === null) return defaults
  const candidate = raw as Record<string, unknown>

  const optionCount = Number(candidate.optionCount)
  const display = (candidate.pinyinDisplay ?? {}) as Record<string, unknown>

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    selection: normalizeSelection(candidate.selection, defaults.selection),
    length: normalizeLength(candidate.length, defaults.length),
    optionCount:
      Number.isFinite(optionCount) && optionCount >= 2 && optionCount <= 8
        ? Math.round(optionCount)
        : defaults.optionCount,
    pinyinDisplay: {
      style: asPinyinStyle(display.style) ?? defaults.pinyinDisplay.style,
      toneColours: display.toneColours === true,
    },
    characterSet: candidate.characterSet === 'trad' ? 'trad' : 'simp',
    autoAdvance: candidate.autoAdvance !== false,
    sound: candidate.sound !== false,
    haptics: candidate.haptics !== false,
    theme: asTheme(candidate.theme) ?? defaults.theme,
  }
}

/**
 * One-time import of the old `wm_options-*` keys.
 *
 * The old app stored an HSK enum offset by 999 (`HSK1 === 1000`) and wrote
 * `gameDurationType: 'questions'` while reading `'rounds'`, which is why its
 * "questions" mode silently behaved as unlimited. Both are corrected here.
 */
export function legacySettingsFrom(storage: StorageLike): Settings | null {
  const read = (key: string) => storage.getItem(key)
  const anyLegacyKey = Object.values(LEGACY).some((key) => read(key) !== null)
  if (!anyLegacyKey) return null

  const settings = defaultSettings()

  const hskLevel = clampHskLevel(Number(read(LEGACY.hskLevel)) - 999)
  const junDaMax = Number(read(LEGACY.jundaMax))
  const wordListType = read(LEGACY.wordListType)

  if (wordListType === 'JunDa' && Number.isFinite(junDaMax) && junDaMax > 0) {
    settings.selection = { kind: 'junda', maxRank: Math.round(junDaMax) }
  } else {
    settings.selection = {
      kind: 'hsk',
      level: hskLevel ?? 1,
      includeLower: read(LEGACY.includeLowerHskLevels) === 'true',
    }
  }

  settings.characterSet = read(LEGACY.characterSet) === 'cn' ? 'simp' : 'trad'

  const durationType = read(LEGACY.durationType)
  const questions = Number(read(LEGACY.durationQuestions))
  const seconds = Number(read(LEGACY.durationSeconds))

  if (durationType === 'time' && Number.isFinite(seconds) && seconds > 0) {
    settings.length = { unit: 'time', value: Math.round(seconds) }
  } else if (durationType === 'questions' && Number.isFinite(questions) && questions > 0) {
    settings.length = { unit: 'rounds', value: Math.round(questions) }
  }

  return settings
}

export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  if (!storage) return defaultSettings()

  const stored = storage.getItem(SETTINGS_KEY)
  if (stored !== null) {
    try {
      return normalizeSettings(JSON.parse(stored))
    } catch {
      // Corrupt payload: fall through and rebuild.
    }
  }

  if (storage.getItem(LEGACY_IMPORT_FLAG) === null) {
    const imported = legacySettingsFrom(storage)
    storage.setItem(LEGACY_IMPORT_FLAG, new Date().toISOString())
    if (imported) {
      saveSettings(imported, storage)
      return imported
    }
  }

  return defaultSettings()
}

export function saveSettings(settings: Settings, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, schemaVersion: SETTINGS_SCHEMA_VERSION }))
  } catch {
    // Storage full or blocked; settings simply will not persist.
  }
}
