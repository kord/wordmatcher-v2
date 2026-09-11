import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { faceFor } from '../../domain/faces'
import type { PinyinDisplay, QuestionFace, QuestionOption } from '../../domain/types'
import { formatClock } from '../../utils/format'
import { useHaptics } from '../../ui/hooks/useHaptics'
import { useFitText } from '../../ui/hooks/useFitText'
import { useReducedMotion } from '../../ui/hooks/useReducedMotion'
import { useRoute } from '../../app/router'
import { useSettings } from '../../ui/hooks/useSettings'
import { useTts } from '../../ui/hooks/useTts'
import { IconButton, Button } from '../../ui/components/Button'
import { PinyinText } from '../../ui/components/PinyinText'
import { ProgressBar } from '../../ui/components/ProgressBar'
import { useSession } from './SessionProvider'
import styles from './session.module.css'

/** Renders whichever surface a face describes. */
function FaceContent({ face, display }: { face: QuestionFace; display: PinyinDisplay }) {
  if (face.kind === 'pinyin' && face.pinyin) {
    return (
      <PinyinText
        pinyin={face.pinyin}
        style={display.style}
        toneColours={display.toneColours}
      />
    )
  }
  return <>{face.text}</>
}

function OptionButton({
  option,
  revealed,
  chosen,
  display,
  onSelect,
}: {
  option: QuestionOption
  revealed: boolean
  chosen: boolean
  display: PinyinDisplay
  onSelect: () => void
}) {
  const { ref } = useFitText<HTMLDivElement>(option.face.text, { max: 40, min: 12 })

  const className = [
    styles.option,
    revealed && option.isAnswer ? styles.optionCorrect : '',
    revealed && !option.isAnswer && chosen ? styles.optionWrong : '',
    revealed && !option.isAnswer && !chosen ? styles.optionDim : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={className} onClick={onSelect} disabled={revealed} data-testid="option">
      <div
        ref={ref}
        className={[styles.optionText, option.face.kind === 'han' ? styles.hanOption : '']
          .filter(Boolean)
          .join(' ')}
      >
        <FaceContent face={option.face} display={display} />
      </div>
    </button>
  )
}

export function SessionScreen() {
  const { state, phase, advance, answer, quit } = useSession()
  const { settings } = useSettings()
  const { navigate } = useRoute()
  const reduced = useReducedMotion()
  const { speak } = useTts()
  const haptic = useHaptics(settings.haptics)

  const [now, setNow] = useState(() => Date.now())
  const [spokenIndex, setSpokenIndex] = useState<number | null>(null)

  const endsAt = state?.endsAt ?? null
  const reveal = state?.phase === 'revealing'
  const outcome = state?.outcome ?? null
  const index = state?.index ?? 0

  useEffect(() => {
    if (phase === 'finished') navigate('summary')
  }, [phase, navigate])

  // Countdown refresh for timed sessions.
  useEffect(() => {
    if (endsAt === null) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [endsAt])

  // Speak the word once per question, when the answer is revealed.
  useEffect(() => {
    if (!reveal || !state || !settings.sound || spokenIndex === index) return
    setSpokenIndex(index)
    speak(faceFor(state.question.entry, 'han', settings.characterSet).text)
  }, [reveal, state, settings.sound, settings.characterSet, speak, spokenIndex, index])

  // Auto-advance, with a longer beat after a miss so the answer can be read.
  useEffect(() => {
    if (!reveal || !settings.autoAdvance) return
    const delay = reduced ? 500 : outcome === 'correct' ? 800 : 1700
    const timer = window.setTimeout(() => advance(), delay)
    return () => window.clearTimeout(timer)
  }, [reveal, index, outcome, settings.autoAdvance, reduced, advance])

  // Keyboard path, so the reveal is never pointer-only.
  useEffect(() => {
    if (!reveal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reveal, advance])

  if (!state) {
    return <div className={styles.session} />
  }

  const { question, config } = state
  const totalRounds = config.length.unit === 'rounds' ? config.length.value : null
  const remaining = endsAt === null ? null : Math.max(0, endsAt - now)
  const progressValue =
    totalRounds !== null
      ? Math.min(1, state.answeredCount / totalRounds)
      : remaining !== null && config.length.unit === 'time'
        ? 1 - remaining / (config.length.value * 1000)
        : 0

  const maxChars = Math.max(...question.options.map((option) => option.face.text.length))
  const columns = maxChars <= 4 ? 2 : 1

  const promptIsHan = question.prompt.kind === 'han'
  const hanText = faceFor(question.entry, 'han', settings.characterSet).text
  // If the prompt already showed the characters, the reveal only needs the
  // reading and the meaning.
  const promptRepeatsAnswer = promptIsHan && question.prompt.text === hanText

  const onSelect = (option: QuestionOption) => {
    haptic(option.isAnswer ? 18 : [24, 40, 24])
    answer(option.entry.id)
  }

  return (
    <div className={styles.session}>
      <div>
        <div className={styles.hud}>
          <IconButton label="End session" onClick={quit}>
            <span aria-hidden="true">✕</span>
          </IconButton>

          <div className={styles.hudItem}>
            <span className={styles.hudValue}>{state.correct}</span>
            <span className={styles.hudLabel}>Correct</span>
          </div>

          <div className={styles.hudItem}>
            <span className={styles.hudValue}>
              {totalRounds !== null ? `${state.answeredCount}/${totalRounds}` : state.answeredCount}
            </span>
            <span className={styles.hudLabel}>{totalRounds !== null ? 'Asked' : 'Rounds'}</span>
          </div>

          <span className={styles.hudSpacer} />

          <div className={styles.hudItem}>
            <span className={styles.hudValue}>{state.streak > 0 ? `🔥${state.streak}` : '—'}</span>
            <span className={styles.hudLabel}>Streak</span>
          </div>

          <div className={[styles.hudItem, styles.hudRight].join(' ')}>
            <span className={styles.hudValue}>
              {remaining !== null ? formatClock(remaining) : `${state.incorrect}`}
            </span>
            <span className={styles.hudLabel}>{remaining !== null ? 'Left' : 'Missed'}</span>
          </div>
        </div>

        <div className={styles.meter}>
          <ProgressBar value={progressValue} label="Session progress" />
        </div>
      </div>

      <div className={styles.prompt} data-testid="prompt">
        <span className={styles.promptHint}>
          {question.prompt.kind === 'han'
            ? 'Choose the meaning'
            : question.prompt.kind === 'gloss'
              ? 'Choose the word'
              : 'Choose the reading'}
        </span>
        <PromptText
          text={question.prompt.text}
          face={question.prompt}
          display={config.pinyinDisplay}
          han={promptIsHan}
        />
      </div>

      {reveal ? (
        <div className={styles.reveal} data-testid="reveal">
          <div
            className={[styles.revealCard, outcome === 'incorrect' ? styles.revealMiss : '']
              .filter(Boolean)
              .join(' ')}
          >
            {promptRepeatsAnswer ? null : <span className={styles.revealWord}>{hanText}</span>}
            <div className={styles.revealMeta}>
              <span className={styles.revealPinyin}>
                <PinyinText
                  pinyin={question.entry.pinyin}
                  style={settings.pinyinDisplay.style}
                  toneColours={settings.pinyinDisplay.toneColours}
                />
              </span>
              <span className={styles.revealGloss}>{question.entry.glossShort}</span>
            </div>
            {settings.sound ? (
              <button
                type="button"
                className={styles.speaker}
                aria-label="Play pronunciation"
                onClick={() => speak(hanText)}
              >
                <span aria-hidden="true">🔊</span>
              </button>
            ) : null}
          </div>
          {settings.autoAdvance ? (
            <p className={styles.tapHint}>Tap anywhere to continue</p>
          ) : (
            <Button variant="primary" block onClick={advance}>
              Continue
            </Button>
          )}
        </div>
      ) : null}

      <div
        className={styles.options}
        style={{ '--columns': columns } as CSSProperties}
        onClick={reveal ? advance : undefined}
      >
        {question.options.map((option) => (
          <OptionButton
            key={option.entry.id}
            option={option}
            revealed={reveal}
            chosen={state.chosenId === option.entry.id}
            display={settings.pinyinDisplay}
            onSelect={() => onSelect(option)}
          />
        ))}
      </div>
    </div>
  )
}

function PromptText({
  text,
  face,
  display,
  han,
}: {
  text: string
  face: QuestionFace
  display: PinyinDisplay
  han: boolean
}) {
  const { ref } = useFitText<HTMLDivElement>(text, { max: han ? 92 : 40, min: 14 })

  return (
    <div
      ref={ref}
      className={[styles.promptText, han ? styles.hanPrompt : ''].filter(Boolean).join(' ')}
    >
      <FaceContent face={face} display={display} />
    </div>
  )
}
