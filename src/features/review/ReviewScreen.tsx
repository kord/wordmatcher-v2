import { useState } from 'react'
import { useRoute } from '../../app/router'
import { faceFor, objectiveLabel } from '../../domain/faces'
import { romanizationFor } from '../../domain/romanization'
import type { MistakeRecord } from '../../domain/types'
import { Button, IconButton } from '../../ui/components/Button'
import { PinyinText } from '../../ui/components/PinyinText'
import { Screen } from '../../ui/components/Screen'
import primitives from '../../ui/components/primitives.module.css'
import { useSettings } from '../../ui/hooks/useSettings'
import { useTts } from '../../ui/hooks/useTts'
import { useSession } from '../session/SessionProvider'
import styles from './review.module.css'

function ReviewCard({ mistake }: { mistake: MistakeRecord }) {
    const { settings } = useSettings()
    const { speak, available: ttsAvailable } = useTts(settings.language)
    const language = settings.byLanguage[settings.language]
    const hanText = faceFor(mistake.entry, 'han', language.characterSet, language.romanization).text

    return (
        <div className={styles.card}>
            <span className={styles.counter}>{objectiveLabel(mistake.objective)}</span>

            <span className={styles.word}>{hanText}</span>

            <span className={styles.pinyin}>
                <PinyinText
                    romanization={romanizationFor(mistake.entry, language.romanization)}
                    style={settings.pinyinDisplay.style}
                    toneColours={settings.pinyinDisplay.toneColours}
                />
            </span>

            <div className={styles.glossList}>
                {/* The difference from Mandarin goes first: for a Taiwanese miss it is usually
                    the thing worth remembering, more than a gloss the learner already knows. */}
                {mistake.entry.mandarin ? (
                    <span>
                        {mistake.entry.mandarin.differs === 'word'
                            ? `Mandarin uses ${mistake.entry.mandarin.trad} (${mistake.entry.mandarin.pinyin.marked})`
                            : `Same characters as Mandarin — ${mistake.entry.mandarin.pinyin.marked}`}
                    </span>
                ) : null}
                {mistake.entry.glosses.map((gloss) => (
                    <span key={gloss}>{gloss}</span>
                ))}
                {mistake.entry.classifiers.length > 0 ? (
                    <span>
                        Classifier{mistake.entry.classifiers.length > 1 ? 's' : ''}:{' '}
                        {mistake.entry.classifiers.map((classifier) => classifier.char).join('、')}
                    </span>
                ) : null}
                {mistake.entry.trad !== mistake.entry.simp ? (
                    <span>
                        {language.characterSet === 'trad' ? mistake.entry.simp : mistake.entry.trad} (other
                        script)
                    </span>
                ) : null}
            </div>

            <div className={styles.compare}>
                <div className={[styles.compareRow, styles.compareWrong].join(' ')}>
                    <span>You chose</span>
                    <span>{mistake.chosenText}</span>
                </div>
                <div className={[styles.compareRow, styles.compareRight].join(' ')}>
                    <span>Correct</span>
                    <span>{mistake.correctText}</span>
                </div>
            </div>

            {ttsAvailable && settings.sound ? (
                <Button variant="secondary" onClick={() => speak(hanText)}>
                    🔊 Play pronunciation
                </Button>
            ) : null}
        </div>
    )
}

export function ReviewScreen() {
    const { summary, practiseMistakes, phase } = useSession()
    const { navigate } = useRoute()
    const [index, setIndex] = useState(0)

    const mistakes = summary?.mistakes ?? []
    if (mistakes.length === 0) {
        return (
            <Screen title="Review" onBack={() => navigate('summary')}>
                <p className={primitives.empty}>Nothing to review — you did not miss anything.</p>
            </Screen>
        )
    }

    const safeIndex = Math.min(index, mistakes.length - 1)

    return (
        <Screen
            title="Review mistakes"
            subtitle={`${safeIndex + 1} of ${mistakes.length}`}
            onBack={() => navigate('summary')}
            footer={
                <>
                    <div className={styles.nav}>
                        <Button
                            variant="secondary"
                            disabled={safeIndex === 0}
                            onClick={() => setIndex((value) => Math.max(0, value - 1))}
                        >
                            ← Previous
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={safeIndex >= mistakes.length - 1}
                            onClick={() => setIndex((value) => Math.min(mistakes.length - 1, value + 1))}
                        >
                            Next →
                        </Button>
                    </div>
                    <Button
                        variant="primary"
                        block
                        disabled={phase === 'loading'}
                        onClick={() => {
                            void practiseMistakes().then((ok) => {
                                if (ok) navigate('session')
                            })
                        }}
                    >
                        Practise these again
                    </Button>
                </>
            }
            headerActions={
                <IconButton label="Back to summary" onClick={() => navigate('summary')}>
                    <span aria-hidden="true">✕</span>
                </IconButton>
            }
        >
            <ReviewCard key={mistakes[safeIndex].entry.id} mistake={mistakes[safeIndex]} />
        </Screen>
    )
}
