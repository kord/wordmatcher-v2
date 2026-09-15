import { ALL_OBJECTIVES, DEFAULT_LENGTH, DEFAULT_OPTION_COUNT, OBJECTIVES } from '../domain/constants'
import type {
    CharacterSet,
    HskLevel,
    Language,
    LanguageSettings,
    ListSelection,
    Objective,
    PinyinStyle,
    RomanizationScheme,
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

/**
 * There is exactly one stored shape, so nothing reads this back yet. It is written anyway
 * so that a future change of shape is a visible diff rather than a silent reinterpretation
 * of whatever happened to be in storage.
 */
export const SETTINGS_SCHEMA_VERSION = 1

export function defaultSettings(): Settings {
    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        language: 'mandarin',
        byLanguage: {
            mandarin: {
                selection: { kind: 'hsk', level: 1, includeLower: false },
                characterSet: 'simp',
                romanization: 'pinyin',
                objectives: [...OBJECTIVES],
            },
            // Taiwanese is written in traditional characters only and is never romanised
            // with pinyin, so these two are fixed rather than offered as choices.
            taiwanese: {
                selection: { kind: 'hsk', level: 1, includeLower: false },
                characterSet: 'trad',
                romanization: 'tailo',
                objectives: [...ALL_OBJECTIVES],
            },
        },
        length: { ...DEFAULT_LENGTH },
        optionCount: DEFAULT_OPTION_COUNT,
        pinyinDisplay: { style: 'diacritic', toneColours: false },
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

function asLanguage(value: unknown): Language | null {
    return value === 'mandarin' || value === 'taiwanese' ? value : null
}

function asScheme(value: unknown): RomanizationScheme | null {
    return value === 'pinyin' || value === 'tailo' || value === 'poj' ? value : null
}

function asCharacterSet(value: unknown, fallback: CharacterSet): CharacterSet {
    return value === 'trad' || value === 'simp' ? value : fallback
}

function normalizeLanguageSettings(
    raw: unknown,
    fallback: LanguageSettings,
    askable: readonly Objective[],
): LanguageSettings {
    if (typeof raw !== 'object' || raw === null) return fallback
    const candidate = raw as Record<string, unknown>

    return {
        selection: normalizeSelection(candidate.selection, fallback.selection),
        characterSet: asCharacterSet(candidate.characterSet, fallback.characterSet),
        romanization: asScheme(candidate.romanization) ?? fallback.romanization,
        objectives: normalizeObjectives(candidate.objectives, fallback.objectives, askable),
    }
}

/**
 * Unknown ids are dropped and the result is re-ordered to `askable`, so the stored set can only
 * ever be a subset in the canonical order. `askable` is what *this variety* can be asked, not
 * everything the app knows, so a Mandarin store cannot hold the contrast drill even if one is
 * written into it by hand.
 *
 * An empty set is refused rather than honoured: a session with no question types has nothing to
 * ask and would fail at start. The panel makes that unreachable by refusing to switch the last
 * one off, so this only matters for a store written by hand or by an older build.
 */
function normalizeObjectives(
    value: unknown,
    fallback: Objective[],
    askable: readonly Objective[],
): Objective[] {
    if (!Array.isArray(value)) return fallback

    const known = askable.filter((objective) => value.includes(objective))
    return known.length > 0 ? [...known] : fallback
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
    const byLanguage = candidate.byLanguage as Record<string, unknown> | undefined

    return {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        language: asLanguage(candidate.language) ?? defaults.language,
        byLanguage: {
            mandarin: normalizeLanguageSettings(
                byLanguage?.mandarin,
                defaults.byLanguage.mandarin,
                OBJECTIVES,
            ),
            taiwanese: normalizeLanguageSettings(
                byLanguage?.taiwanese,
                defaults.byLanguage.taiwanese,
                ALL_OBJECTIVES,
            ),
        },
        length: normalizeLength(candidate.length, defaults.length),
        optionCount:
            Number.isFinite(optionCount) && optionCount >= 2 && optionCount <= 8
                ? Math.round(optionCount)
                : defaults.optionCount,
        pinyinDisplay: {
            style: asPinyinStyle(display.style) ?? defaults.pinyinDisplay.style,
            toneColours: display.toneColours === true,
        },
        autoAdvance: candidate.autoAdvance !== false,
        sound: candidate.sound !== false,
        haptics: candidate.haptics !== false,
        theme: asTheme(candidate.theme) ?? defaults.theme,
    }
}

export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
    if (!storage) return defaultSettings()

    const stored = storage.getItem(SETTINGS_KEY)
    if (stored !== null) {
        try {
            return normalizeSettings(JSON.parse(stored))
        } catch {
            // Corrupt payload: fall through to the defaults rather than throwing.
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
