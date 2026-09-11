import { toneSuperscript, renderPinyinSyllables, renderPinyinText } from '../../domain/pinyin'
import type { Pinyin, PinyinStyle } from '../../domain/types'
import styles from './primitives.module.css'

export interface PinyinTextProps {
    pinyin: Pinyin
    style: PinyinStyle
    toneColours: boolean
    className?: string
}

/**
 * Renders pinyin in whichever style the settings ask for. Because the tone
 * number is stored per syllable, switching style needs no conversion step.
 */
export function PinyinText({ pinyin, style, toneColours, className }: PinyinTextProps) {
    const syllables = renderPinyinSyllables(pinyin, style)

    return (
        <span
            className={[styles.pinyin, className ?? ''].filter(Boolean).join(' ')}
            aria-label={renderPinyinText(pinyin, 'diacritic')}
        >
            {syllables.map((syllable, index) => (
                <span
                    key={`${syllable.text}-${index}`}
                    className={styles.syllable}
                    data-tone={toneColours ? syllable.tone : undefined}
                >
                    {index > 0 ? ' ' : ''}
                    {syllable.text}
                    {syllable.superscript ? <sup>{toneSuperscript(syllable.tone)}</sup> : null}
                </span>
            ))}
        </span>
    )
}
