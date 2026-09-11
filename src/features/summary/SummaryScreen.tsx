import { useRoute } from '../../app/router'
import { faceFor } from '../../domain/faces'
import { Button } from '../../ui/components/Button'
import { PinyinText } from '../../ui/components/PinyinText'
import { ProgressBar } from '../../ui/components/ProgressBar'
import { Screen } from '../../ui/components/Screen'
import primitives from '../../ui/components/primitives.module.css'
import { useSettings } from '../../ui/hooks/useSettings'
import { formatDuration, formatPercent } from '../../utils/format'
import { useSession } from '../session/SessionProvider'
import styles from './summary.module.css'

export function SummaryScreen() {
  const { summary, practiseMistakes, phase } = useSession()
  const { settings } = useSettings()
  const { navigate } = useRoute()

  if (!summary) return null

  const accuracy = summary.total > 0 ? summary.correct / summary.total : 0
  const missed = summary.mistakes

  return (
    <Screen
      title="Session complete"
      subtitle={summary.listNames.join(' · ')}
      footer={
        <>
          {missed.length > 0 ? (
            <>
              <Button variant="primary" block onClick={() => navigate('review')}>
                Review mistakes ({missed.length})
              </Button>
              <Button
                variant="secondary"
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
          ) : (
            <Button variant="primary" block onClick={() => navigate('home')}>
              Nice — back to home
            </Button>
          )}
          <Button variant="ghost" block onClick={() => navigate('home')}>
            Done
          </Button>
        </>
      }
    >
      <div className={styles.score}>
        <span className={styles.scoreValue}>
          {summary.correct}/{summary.total}
        </span>
        <span className={styles.scoreLabel}>Correct</span>
        <div style={{ width: '100%', marginTop: 'var(--space-3)' }}>
          <ProgressBar value={accuracy} label="Accuracy" />
        </div>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatPercent(accuracy)}</span>
          <span className={styles.statLabel}>Accuracy</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{summary.longestStreak}</span>
          <span className={styles.statLabel}>Longest streak</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatDuration(summary.durationMs)}</span>
          <span className={styles.statLabel}>Time played</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{summary.incorrect}</span>
          <span className={styles.statLabel}>Wrong answers</span>
        </div>
      </div>

      {missed.length > 0 ? (
        <div className={primitives.card}>
          <div className={primitives.cardLabel}>
            {missed.length === summary.incorrect
              ? 'Words to review'
              : `${missed.length} words to review`}
          </div>
          {missed.map((mistake) => (
            <div className={styles.missedItem} key={mistake.entry.id}>
              <div>
                <div className={styles.missedWord}>
                  {faceFor(mistake.entry, 'han', settings.characterSet).text}
                </div>
                <PinyinText
                  pinyin={mistake.entry.pinyin}
                  style={settings.pinyinDisplay.style}
                  toneColours={settings.pinyinDisplay.toneColours}
                />
              </div>
              <div className={styles.missedGloss}>
                {mistake.entry.glossShort}
                <br />
                <span style={{ opacity: 0.7 }}>you chose “{mistake.chosenText}”</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Screen>
  )
}
