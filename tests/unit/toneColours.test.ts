import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Tone } from '../../src/domain/types'

/**
 * Tone colouring has to cover every tone the app can print.
 *
 * It used to stop at four, which was right while only pinyin existed. Tâi-lô then added 5, 7 and
 * 8, and those syllables fell through to the inherited colour — so a Taiwanese word came out only
 * half coloured, which reads as a bug rather than as a missing shade.
 *
 * Nobody noticed because the only sample in the UI was pinyin. The settings preview now shows a
 * Tâi-lô sample for Tâi-lô, and this file is the guard behind it.
 */
const TONES: Tone[] = [0, 1, 2, 3, 4, 5, 7, 8]

const tokens = readFileSync(join(process.cwd(), 'src', 'ui', 'tokens.css'), 'utf8')
const primitives = readFileSync(
    join(process.cwd(), 'src', 'ui', 'components', 'primitives.module.css'),
    'utf8',
)

const darkThemeStart = tokens.indexOf("[data-theme='dark']")
const lightTheme = tokens.slice(0, darkThemeStart)
const darkTheme = tokens.slice(darkThemeStart)

/**
 * Every tone that appears in a built Taiwanese list, which is what a learner will actually see.
 *
 * Checked alongside the static list above so that a tone genuinely in use still fails here even
 * if nobody remembers to add it to that list.
 */
function tonesInUse(): number[] {
    const tones = new Set<number>()

    for (const id of ['hsk1-tw', 'hsk2-tw', 'hsk3-tw']) {
        const file = JSON.parse(
            readFileSync(join(process.cwd(), 'public', 'data', 'lists', `${id}.json`), 'utf8'),
        ) as { entries: { romanizations?: Record<string, { syllables?: { tone: number }[] }> }[] }

        for (const entry of file.entries) {
            for (const reading of Object.values(entry.romanizations ?? {})) {
                for (const syllable of reading?.syllables ?? []) tones.add(syllable.tone)
            }
        }
    }

    return [...tones].sort((a, b) => a - b)
}

describe('every tone the app can print', () => {
    it.each(TONES)('has a colour token for tone %i in both themes', (tone) => {
        expect(lightTheme, 'light theme').toContain(`--tone-${tone}:`)
        expect(darkTheme, 'dark theme').toContain(`--tone-${tone}:`)
    })

    it.each(TONES)('is actually coloured by tone %i', (tone) => {
        expect(primitives).toContain(`[data-tone='${tone}']`)
    })
})

describe('the palette covers the tones in the data', () => {
    const inUse = tonesInUse()

    it('found tones to check, rather than passing by finding none', () => {
        expect(inUse.length).toBeGreaterThan(4)
    })

    it.each(inUse)('colours tone %i, which the lists do use', (tone) => {
        expect(lightTheme).toContain(`--tone-${tone}:`)
        expect(darkTheme).toContain(`--tone-${tone}:`)
        expect(primitives).toContain(`[data-tone='${tone}']`)
    })
})
