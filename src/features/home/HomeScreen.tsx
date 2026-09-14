import { useEffect, useState } from 'react'
import { useRoute } from '../../app/router'
import { useManifest } from '../../content/useManifest'
import { listIdsFor } from '../../content/wordPool'
import { LANGUAGE_LABELS } from '../../domain/languages'
import type { Language } from '../../domain/types'
import { Button } from '../../ui/components/Button'
import { Screen } from '../../ui/components/Screen'
import { SegmentedControl } from '../../ui/components/SegmentedControl'
import primitives from '../../ui/components/primitives.module.css'
import { useSettings } from '../../ui/hooks/useSettings'
import { countSessions } from '../../storage/sessionRepo'
import { useSession } from '../session/SessionProvider'
import styles from './home.module.css'

/**
 * Named here rather than read from the manifest, because the choice has to be offerable
 * before any list has loaded. Cantonese joins this list later.
 */
const LANGUAGES: { value: Language; label: string; glyph: string }[] = [
    { value: 'mandarin', label: LANGUAGE_LABELS.mandarin, glyph: '学' },
    { value: 'taiwanese', label: LANGUAGE_LABELS.taiwanese, glyph: '學' },
]

export function HomeScreen() {
    const { settings, update } = useSettings()
    const { manifest, error: manifestError } = useManifest()
    const { start, phase, error } = useSession()
    const { navigate } = useRoute()

    /*
     * Whether this learner has finished a session in this variety yet.
     *
     * Null until it is known, so nothing is claimed about a first run before the answer arrives.
     * Deliberately per-variety: someone who has played Mandarin for a month is still starting from
     * nothing in Taiwanese.
     */
    const [played, setPlayed] = useState<boolean | null>(null)

    useEffect(() => {
        let cancelled = false
        void countSessions(settings.language).then((count) => {
            if (!cancelled) setPlayed(count > 0)
        })
        return () => {
            cancelled = true
        }
    }, [settings.language])

    const language = settings.byLanguage[settings.language]
    const wantedIds = listIdsFor(language.selection, settings.language)

    const total = wantedIds
        .map((id) => manifest?.lists.find((list) => list.id === id)?.count)
        .filter((count): count is number => typeof count === 'number')
        .reduce((sum, count) => sum + count, 0)

    const listLabel =
        language.selection.kind === 'junda'
            ? `Jun Da · top ${language.selection.maxRank.toLocaleString()}`
            : language.selection.includeLower
                ? `HSK 1–${language.selection.level}`
                : `HSK ${language.selection.level}`

    const active = LANGUAGES.find((entry) => entry.value === settings.language) ?? LANGUAGES[0]

    // Taiwanese has two orthographies to choose between rather than three ways of writing
    // tones, so its label names the scheme instead of the style.
    const readingLabel =
        settings.language === 'taiwanese'
            ? language.romanization === 'tailo'
                ? 'Tâi-lô'
                : 'POJ'
            : settings.pinyinDisplay.style === 'diacritic'
                ? 'Tone marks'
                : settings.pinyinDisplay.style === 'numbers'
                    ? 'Tone numbers'
                    : 'Superscript tones'

    const firstRun = played === false

    return (
        <Screen
            title="Word Matcher"
            subtitle={`Adaptive ${active.label} practice`}
            headerActions={
                <Button variant="ghost" aria-label="Settings" onClick={() => navigate('settings')}>
                    ⚙︎
                </Button>
            }
            footer={
                <>
                    <Button
                        variant="primary"
                        block
                        disabled={phase === 'loading'}
                        onClick={() => {
                            void start().then((ok) => {
                                if (ok) navigate('session')
                            })
                        }}
                    >
                        {phase === 'loading'
                            ? 'Preparing…'
                            : firstRun
                              ? 'Start your first session'
                              : 'Start session'}
                    </Button>
                    {firstRun ? (
                        // There is nothing to show yet, so say that here rather than let the
                        // button lead a first-time user to an empty screen.
                        <p className={styles.hint}>Your progress will show up here afterwards.</p>
                    ) : (
                        <Button variant="secondary" block onClick={() => navigate('progress')}>
                            Your progress
                        </Button>
                    )}
                </>
            }
        >
            {/* The variety is the one choice that fixes an entire session, so it lives on the
                home screen rather than only inside settings. */}
            <SegmentedControl
                label="Language"
                value={settings.language}
                options={LANGUAGES}
                onChange={(next) => update({ language: next })}
            />

            {/*
             * Mandarin and Taiwanese are not a cosmetic choice: Taiwanese brings a second
             * orthography with it, and a learner should learn that here rather than by wondering
             * why the readings suddenly look unfamiliar.
             */}
            {settings.language === 'taiwanese' ? (
                <p className={styles.hint}>
                    Taiwanese is read in either Tâi-lô or POJ. You have {readingLabel} — change it in
                    Settings.
                </p>
            ) : null}

            <div className={styles.hero}>
                <div className={styles.heroWord} aria-hidden="true">
                    {active.glyph}
                </div>
                <p className={styles.heroText}>
                    {settings.length.unit === 'rounds'
                        ? `${settings.length.value} questions`
                        : `${Math.round(settings.length.value / 60)} minutes`}
                </p>
                <p className={styles.heroTask}>Tap the right answer.</p>
                <p className={styles.heroSub}>
                    {listLabel}
                    {total > 0 ? ` · ${total.toLocaleString()} words` : ''}
                </p>
                <p className={styles.heroSub}>
                    {readingLabel} ·{' '}
                    {language.characterSet === 'trad' ? 'Traditional' : 'Simplified'}
                </p>
            </div>

            {error ? <p className={primitives.error}>{error}</p> : null}
            {manifestError ? <p className={primitives.error}>{manifestError}</p> : null}

            <p className={styles.note}>
                Each one shows a word, its meaning or a reading, with four options to pick from.
                Anything you miss comes back before the session ends.
            </p>
        </Screen>
    )
}
