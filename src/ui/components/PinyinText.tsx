import {
    toneSuperscript,
    renderPinyinSyllables,
    renderPinyinText,
    separatorsOf,
} from '../../domain/pinyin'
import type { PinyinStyle, Romanization } from '../../domain/types'
import styles from './primitives.module.css'

export interface PinyinTextProps {
    /** Absent when the entry holds no reading for the scheme in play; renders nothing. */
    romanization: Romanization | undefined
    style: PinyinStyle
    toneColours: boolean
    className?: string
}

/**
 * Renders a reading in whichever style the settings ask for. Because the tone
 * number is stored per syllable, switching style needs no conversion step.
 *
 * Pinyin and Tai-lo both mark tone with a diacritic on the syllable, so the diacritic and
 * numbered styles mean the same thing in each. Only the superscript style is pinyin-shaped,
 * which is why the settings offer it for Mandarin and not for Taiwanese.
 */
export function PinyinText({ romanization, style, toneColours, className }: PinyinTextProps) {
    if (!romanization) return null

    const syllables = renderPinyinSyllables(romanization, style)
    // Pinyin separates syllables with a space; Tai-lo and POJ hyphenate within a word. The
    // written form already knows which, so the separator is taken from it rather than
    // assumed, or 先生 would render as the two words `sian senn`.
    const separators = separatorsOf(romanization)

    return (
        <span
            className={[styles.pinyin, className ?? ''].filter(Boolean).join(' ')}
            aria-label={renderPinyinText(romanization, 'diacritic')}
        >
            {syllables.map((syllable, index) => (
                <span
                    key={`${syllable.text}-${index}`}
                    className={styles.syllable}
                    data-tone={toneColours ? syllable.tone : undefined}
                >
                    {separators[index] ?? ' '}
                    {syllable.text}
                    {syllable.superscript ? <sup>{toneSuperscript(syllable.tone)}</sup> : null}
                </span>
            ))}
        </span>
    )
}
