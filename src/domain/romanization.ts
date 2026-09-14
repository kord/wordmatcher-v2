import type { Language, Romanization, RomanizationScheme, WordEntry } from './types'

/**
 * The scheme shown when the learner has not chosen one.
 *
 * Tai-lo rather than POJ for Taiwanese, because it is the scheme Taiwan's Ministry of
 * Education uses: it is what a learner there meets on signage and in teaching material.
 * POJ ships alongside it because most older dictionaries print that, and a learner
 * arriving from one of those should not have to convert in their head.
 */
export const DEFAULT_SCHEME: Record<Language, RomanizationScheme> = {
    mandarin: 'pinyin',
    taiwanese: 'tailo',
}

/**
 * The reading to display for a word, preferring the requested scheme.
 *
 * Falls back to the language's default when the requested scheme is not held. Asking a
 * Mandarin entry for Tai-lo is a settings/language mismatch rather than a bug, so it
 * resolves to pinyin rather than rendering nothing.
 */
export function romanizationFor(
    entry: WordEntry,
    scheme: RomanizationScheme,
): Romanization | undefined {
    return entry.romanizations[scheme] ?? entry.romanizations[DEFAULT_SCHEME[entry.language]]
}

/** The reading used when no scheme is being displayed, e.g. ranking distractors. */
export function primaryRomanization(entry: WordEntry): Romanization | undefined {
    return romanizationFor(entry, DEFAULT_SCHEME[entry.language])
}
