import { useEffect, useState } from 'react'
import { useRoute } from '../../app/router'
import { MAX_BOX } from '../../domain/constants'
import type { ProgressRecord, StoredSession } from '../../domain/types'
import { Button } from '../../ui/components/Button'
import { ProgressBar } from '../../ui/components/ProgressBar'
import { Screen } from '../../ui/components/Screen'
import primitives from '../../ui/components/primitives.module.css'
import { formatPercent } from '../../utils/format'
import { loadProgress } from '../../storage/progressRepo'
import { loadSessions } from '../../storage/sessionRepo'
import { useSession } from '../session/SessionProvider'
import styles from './progress.module.css'

interface Stats {
  touched: number
  mastered: number
  learning: number
  dueNow: number
  accuracy: number
}

function summarise(records: ProgressRecord[], now: number): Stats {
  let touched = 0
  let mastered = 0
  let dueNow = 0
  let correct = 0
  let seen = 0

  for (const record of records) {
    if (record.seen === 0) continue
    touched++
    if (record.box >= MAX_BOX) mastered++
    if (record.dueAt <= now) dueNow++
    correct += record.correct
    seen += record.seen
  }

  return {
    touched,
    mastered,
    learning: touched - mastered,
    dueNow,
    accuracy: seen === 0 ? 0 : correct / seen,
  }
}

export function ProgressScreen() {
  const { navigate } = useRoute()
  const { progressRevision } = useSession()
  const [records, setRecords] = useState<ProgressRecord[] | null>(null)
  const [sessions, setSessions] = useState<StoredSession[] | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.all([loadProgress(), loadSessions(10)]).then(([map, history]) => {
      if (cancelled) return
      setRecords([...map.values()])
      setSessions(history)
    })

    return () => {
      cancelled = true
    }
  }, [progressRevision])

  const stats = records ? summarise(records, Date.now()) : null

  return (
    <Screen
      title="Your progress"
      subtitle={stats ? `${stats.touched.toLocaleString()} words seen` : undefined}
      onBack={() => navigate('home')}
    >
      {stats ? (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.touched.toLocaleString()}</span>
              <span className={styles.statLabel}>Words practised</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.mastered.toLocaleString()}</span>
              <span className={styles.statLabel}>Mastered</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{stats.dueNow.toLocaleString()}</span>
              <span className={styles.statLabel}>Due for review</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatPercent(stats.accuracy)}</span>
              <span className={styles.statLabel}>All-time accuracy</span>
            </div>
          </div>

          <div className={primitives.card}>
            <div className={styles.masteryHeader}>
              <span>Mastery</span>
              <span>
                {stats.mastered.toLocaleString()} / {stats.touched.toLocaleString()}
              </span>
            </div>
            <ProgressBar
              value={stats.touched === 0 ? 0 : stats.mastered / stats.touched}
              label="Mastery"
            />
          </div>
        </>
      ) : (
        <p className={primitives.empty}>Loading…</p>
      )}

      <div className={primitives.card}>
        <div className={primitives.cardLabel}>Recent sessions</div>
        {sessions === null ? (
          <p className={styles.sessionMeta}>Loading…</p>
        ) : sessions.length === 0 ? (
          <p className={styles.sessionMeta}>No sessions yet. Play one to see it here.</p>
        ) : (
          sessions.map((session) => {
            const { summary } = session
            const accuracy = summary.total === 0 ? 0 : summary.correct / summary.total
            return (
              <div className={styles.sessionRow} key={session.id}>
                <span className={styles.sessionMeta}>
                  {new Date(session.startedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  · {summary.listNames.join(', ')}
                </span>
                <span>
                  <span className={styles.sessionScore}>
                    {summary.correct}/{summary.total}
                  </span>{' '}
                  <span className={styles.sessionMeta}>{formatPercent(accuracy)}</span>
                </span>
              </div>
            )
          })
        )}
      </div>

      <div className={primitives.card}>
        <div className={primitives.cardLabel}>How the scheduling works</div>
        <p className={styles.sessionMeta}>
          Every word sits in one of six boxes. Strong words rest for days; shaky ones come back within
          minutes. Miss a word and you will see it again before the session ends, then once more in
          the review.
        </p>
      </div>

      <Button variant="secondary" block onClick={() => navigate('home')}>
        Back to home
      </Button>
    </Screen>
  )
}
