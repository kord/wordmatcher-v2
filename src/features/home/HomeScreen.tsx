import { useRoute } from '../../app/router'
import { useManifest } from '../../content/useManifest'
import { Button } from '../../ui/components/Button'
import { Screen } from '../../ui/components/Screen'
import primitives from '../../ui/components/primitives.module.css'
import { useSettings } from '../../ui/hooks/useSettings'
import { useSession } from '../session/SessionProvider'
import styles from './home.module.css'

export function HomeScreen() {
    const { settings } = useSettings()
    const { manifest, error: manifestError } = useManifest()
    const { start, phase, error } = useSession()
    const { navigate } = useRoute()

    const wantedIds =
        settings.selection.kind === 'junda'
            ? ['junda']
            : settings.selection.includeLower
                ? Array.from({ length: settings.selection.level }, (_, index) => `hsk${index + 1}`)
                : [`hsk${settings.selection.level}`]

    const total = wantedIds
        .map((id) => manifest?.lists.find((list) => list.id === id)?.count)
        .filter((count): count is number => typeof count === 'number')
        .reduce((sum, count) => sum + count, 0)

    const listLabel =
        settings.selection.kind === 'junda'
            ? `Jun Da · top ${settings.selection.maxRank.toLocaleString()}`
            : settings.selection.includeLower
                ? `HSK 1–${settings.selection.level}`
                : `HSK ${settings.selection.level}`

    const pinyinLabel =
        settings.pinyinDisplay.style === 'diacritic'
            ? 'Tone marks'
            : settings.pinyinDisplay.style === 'numbers'
                ? 'Tone numbers'
                : 'Superscript tones'

    return (
        <Screen
            title="Word Matcher"
            subtitle="Adaptive Mandarin practice"
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
                        {phase === 'loading' ? 'Preparing…' : 'Start session'}
                    </Button>
                    <Button variant="secondary" block onClick={() => navigate('progress')}>
                        Your progress
                    </Button>
                </>
            }
        >
            <div className={styles.hero}>
                <div className={styles.heroWord} aria-hidden="true">
                    学
                </div>
                <p className={styles.heroText}>
                    {settings.length.unit === 'rounds'
                        ? `${settings.length.value} rounds`
                        : `${Math.round(settings.length.value / 60)} minutes`}
                </p>
                <p className={styles.heroSub}>
                    {listLabel}
                    {total > 0 ? ` · ${total.toLocaleString()} words` : ''}
                </p>
                <p className={styles.heroSub}>
                    {pinyinLabel} · {settings.characterSet === 'trad' ? 'Traditional' : 'Simplified'}
                </p>
            </div>

            {error ? <p className={primitives.error}>{error}</p> : null}
            {manifestError ? <p className={primitives.error}>{manifestError}</p> : null}

            <p className={styles.note}>
                Answers you miss come back later in the same session, and every session ends with a review of
                the words you got wrong.
            </p>
        </Screen>
    )
}
