import type { Language } from './types'

/**
 * Display names, in one place so every screen labels a variety the same way.
 *
 * Not read from the manifest: a screen may need the name before any list has loaded, and
 * the set of varieties the app supports is a fact about the app rather than about the data.
 */
export const LANGUAGE_LABELS: Record<Language, string> = {
    mandarin: 'Mandarin',
    taiwanese: 'Taiwanese',
}
