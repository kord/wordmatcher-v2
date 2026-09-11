import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRoute } from '../../app/router'
import { faceFor, taskHintFor } from '../../domain/faces'
import { isHan } from '../../domain/han'
import type { PinyinDisplay, QuestionFace, QuestionOption } from '../../domain/types'
import { formatClock } from '../../utils/format'
import { Button, IconButton } from '../../ui/components/Button'
import { PinyinText } from '../../ui/components/PinyinText'
import { ProgressBar } from '../../ui/components/ProgressBar'
import { useFitText } from '../../ui/hooks/useFitText'
import { useHaptics } from '../../ui/hooks/useHaptics'
import { useReducedMotion } from '../../ui/hooks/useReducedMotion'
import { useSettings } from '../../ui/hooks/useSettings'
import { useTts } from '../../ui/hooks/useTts'
import { planOptionGrid, promptRowUnits, type GridPlan } from '../../ui/optionGrid'
import { REFERENCE_FONT_SIZE, textWidthAtReference } from '../../ui/textMetrics'
import { useSession } from './SessionProvider'
import styles from './session.module.css'

/**
 * Font ceilings. The real size is whatever fits the box, so these only stop the
 * prompt from growing absurdly on a very large screen. The prompt is allowed to
 * grow a long way, which is what makes it fill the space when there is space.
 */
const PROMPT_MAX_FONT = { han: 320, pinyin: 160, gloss: 160 } as const
const MIN_FONT_SIZE = 12
const OPTION_MAX_FONT = 48

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
    fontSize,
    onSelect,
}: {
    option: QuestionOption
    revealed: boolean
    chosen: boolean
    display: PinyinDisplay
    fontSize: number
    onSelect: () => void
}) {
    const className = [
        styles.option,
        revealed && option.isAnswer ? styles.optionCorrect : '',
        revealed && !option.isAnswer && chosen ? styles.optionWrong : '',
        revealed && !option.isAnswer && !chosen ? styles.optionDim : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button
            type="button"
            className={className}
            onClick={onSelect}
            disabled={revealed}
            data-testid="option"
        >
            <div
                data-option-text=""
                style={{ fontSize }}
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
    const { speak, available: ttsAvailable } = useTts()
    const haptic = useHaptics(settings.haptics)

    const [now, setNow] = useState(() => Date.now())
    const [spokenIndex, setSpokenIndex] = useState<number | null>(null)
    const [plan, setPlan] = useState<GridPlan | null>(null)
    const [planDebug, setPlanDebug] = useState('')
    /**
     * Correction factor for the planned font size, derived from what the browser
     * actually laid out. The analytic grid model decides the shape and gets the
     * size close, but flexbox has min-content floors (a wrapped option cannot be
     * shorter than its own text) that no arithmetic model can fully predict, so
     * the result is verified and trimmed rather than trusted.
     */
    const [fontAdjust, setFontAdjust] = useState(1)
    const adjustCountRef = useRef(0)
    /** Grid shape chosen while asking; held steady so the reveal cannot jolt it. */
    const lockedGridRef = useRef<Pick<GridPlan, 'columns' | 'promptFlex' | 'optionsFlex'> | null>(
        null,
    )

    const playAreaRef = useRef<HTMLDivElement | null>(null)
    const optionsRef = useRef<HTMLDivElement | null>(null)

    const endsAt = state?.endsAt ?? null
    const reveal = state?.phase === 'revealing'
    const outcome = state?.outcome ?? null
    const index = state?.index ?? 0
    const question = state?.question

    useEffect(() => {
        if (phase === 'finished') navigate('summary')
    }, [phase, navigate])

    // Countdown refresh for timed sessions.
    useEffect(() => {
        if (endsAt === null) return
        const timer = window.setInterval(() => setNow(Date.now()), 500)
        return () => window.clearInterval(timer)
    }, [endsAt])

    /**
     * Choose the grid geometry from what the text actually measures.
     *
     * While asking, this decides both the shape and the font size. While the
     * reveal is on screen it only re-fits the font: the grid the player is looking
     * at must not jump, but the reveal takes height away, so the text has to
     * shrink slightly to avoid being clipped.
     */
    useLayoutEffect(() => {
        if (!question) return

        const playArea = playAreaRef.current
        const optionsBox = optionsRef.current
        if (!playArea || !optionsBox) return

        const planGrid = () => {
            const optionButton = optionsBox.querySelector<HTMLElement>('[data-testid="option"]')
            const optionText = optionsBox.querySelector<HTMLElement>('[data-option-text]')
            if (!optionButton || !optionText) return

            const gridStyle = getComputedStyle(optionsBox)
            const optionStyle = getComputedStyle(optionButton)
            const textStyle = getComputedStyle(optionText)

            const px = (value: string): number => Number.parseFloat(value) || 0

            const gap = px(gridStyle.rowGap) || px(gridStyle.gap)
            // The box is border-box, so borders eat into the room the text can use.
            const insetX =
                px(optionStyle.paddingLeft) + px(optionStyle.paddingRight) +
                px(optionStyle.borderLeftWidth) + px(optionStyle.borderRightWidth)
            const insetY =
                px(optionStyle.paddingTop) + px(optionStyle.paddingBottom) +
                px(optionStyle.borderTopWidth) + px(optionStyle.borderBottomWidth)

            const textFontSize = px(textStyle.fontSize) || 16
            const textLineHeight = px(textStyle.lineHeight)
            const lineHeight = textLineHeight > 0 ? textLineHeight / textFontSize : 1.15

            // The prompt and the options share the play area. A reveal on screen takes
            // its own height plus the gaps around it out of that budget, and the space
            // between the two blocks is the play area's gap, not the grid's.
            const playStyle = getComputedStyle(playArea)
            const playGap = px(playStyle.rowGap) || px(playStyle.gap)
            const revealElement = playArea.querySelector<HTMLElement>('[data-testid="reveal"]')
            const revealHeight = revealElement ? revealElement.getBoundingClientRect().height : 0
            const sharedHeight =
                playArea.clientHeight - playGap - (revealElement ? playGap + revealHeight : 0)

            const font = `${textStyle.fontWeight} ${REFERENCE_FONT_SIZE}px ${textStyle.fontFamily}`
            const widthsAtReference = question.options.map((option) =>
                textWidthAtReference(option.face.text, font),
            )
            const unitWidthsAtReference = question.options.map((option) =>
                breakableUnits(option.face.text).map((unit) => textWidthAtReference(unit, font)),
            )
            const spaceWidthAtReference = textWidthAtReference(' ', font)

            const gridInput = {
                count: question.options.length,
                widthsAtReference,
                unitWidthsAtReference,
                spaceWidthAtReference,
                gridWidth: optionsBox.clientWidth,
                sharedHeight,
                gap,
                promptUnits: promptRowUnits(question.prompt.text.length),
                insetX,
                insetY,
                lineHeight,
                minFontSize: MIN_FONT_SIZE,
                maxFontSize: OPTION_MAX_FONT,
            }

            const next = planOptionGrid(gridInput)

            if (reveal) {
                // Keep the locked shape; adopt only the re-fitted font size.
                const locked = lockedGridRef.current
                setPlan(locked ? { ...next, ...locked } : next)
            } else {
                lockedGridRef.current = {
                    columns: next.columns,
                    promptFlex: next.promptFlex,
                    optionsFlex: next.optionsFlex,
                }
                setPlan(next)
            }

            setPlanDebug(
                JSON.stringify({
                    ...gridInput,
                    widthsAtReference: widthsAtReference.map((width) => Math.round(width)),
                    columns: next.columns,
                    rows: next.rows,
                    fontSize: Math.round(next.fontSize),
                }),
            )
        }

        planGrid()

        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(planGrid)
        observer.observe(playArea)
        return () => observer.disconnect()
    }, [question, reveal])

    // Every new question starts from the model's size again.
    useEffect(() => {
        adjustCountRef.current = 0
        setFontAdjust(1)
    }, [question])

    /**
     * Verify the planned size against the real boxes and trim if anything spills.
     * Bounded to a couple of passes so a stubborn layout cannot loop.
     */
    useLayoutEffect(() => {
        const optionsBox = optionsRef.current
        if (!optionsBox || !plan || adjustCountRef.current >= 3) return

        const px = (value: string): number => Number.parseFloat(value) || 0
        let worstRatio = 1

        for (const text of Array.from(
            optionsBox.querySelectorAll<HTMLElement>('[data-option-text]'),
        )) {
            const button = text.closest('button')
            if (!button) continue

            const style = getComputedStyle(button)
            const availableHeight =
                button.clientHeight -
                px(style.paddingTop) - px(style.paddingBottom) -
                px(style.borderTopWidth) - px(style.borderBottomWidth)
            const availableWidth =
                button.clientWidth -
                px(style.paddingLeft) - px(style.paddingRight) -
                px(style.borderLeftWidth) - px(style.borderRightWidth)

            const rect = text.getBoundingClientRect()
            if (availableHeight > 0 && rect.height > availableHeight + 0.5) {
                worstRatio = Math.min(worstRatio, availableHeight / rect.height)
            }
            if (availableWidth > 0 && rect.width > availableWidth + 0.5) {
                worstRatio = Math.min(worstRatio, availableWidth / rect.width)
            }
        }

        if (worstRatio < 0.995) {
            adjustCountRef.current += 1
            setFontAdjust((current) => Math.max(0.4, current * worstRatio * 0.98))
        }
    }, [plan, fontAdjust, question, reveal])

    // Speak the word once per question, when the answer is revealed.
    useEffect(() => {
        if (!reveal || !state || !settings.sound || !ttsAvailable || spokenIndex === index) return
        setSpokenIndex(index)
        speak(faceFor(state.question.entry, 'han', settings.characterSet).text)
    }, [
        reveal,
        state,
        settings.sound,
        settings.characterSet,
        ttsAvailable,
        speak,
        spokenIndex,
        index,
    ])

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

    const onSelect = useCallback(
        (option: QuestionOption) => {
            haptic(option.isAnswer ? 18 : [24, 40, 24])
            answer(option.id)
        },
        [answer, haptic],
    )

    if (!state) {
        return <div className={styles.session} />
    }

    const { config } = state
    const totalRounds = config.length.unit === 'rounds' ? config.length.value : null
    const remaining = endsAt === null ? null : Math.max(0, endsAt - now)
    const progressValue =
        totalRounds !== null
            ? Math.min(1, state.answeredCount / totalRounds)
            : remaining !== null && config.length.unit === 'time'
                ? 1 - remaining / (config.length.value * 1000)
                : 0

    const hanText = faceFor(state.question.entry, 'han', settings.characterSet).text
    const promptIsHan = state.question.prompt.kind === 'han'
    const promptRepeatsAnswer = promptIsHan && state.question.prompt.text === hanText

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

            <div className={styles.playArea} ref={playAreaRef}>
                <div
                    className={styles.prompt}
                    style={{ flexGrow: plan?.promptFlex ?? 2.5 }}
                    data-testid="prompt"
                >
                    <span className={styles.promptHint}>{taskHintFor(state.question.objective)}</span>
                    <PromptText
                        text={state.question.prompt.text}
                        face={state.question.prompt}
                        display={config.pinyinDisplay}
                        kind={state.question.prompt.kind}
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
                                        pinyin={state.question.entry.pinyin}
                                        style={settings.pinyinDisplay.style}
                                        toneColours={settings.pinyinDisplay.toneColours}
                                    />
                                </span>
                                <span className={styles.revealGloss}>{state.question.entry.glossShort}</span>
                            </div>
                            {settings.sound && ttsAvailable ? (
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
                    ref={optionsRef}
                    className={styles.options}
                    style={
                        {
                            '--columns': plan?.columns ?? 1,
                            flexGrow: plan?.optionsFlex ?? 2,
                        } as CSSProperties
                    }
                    data-testid="options"
                    data-plan={planDebug}
                    onClick={reveal ? advance : undefined}
                >
                    {state.question.options.map((option) => (
                        <OptionButton
                            key={option.id}
                            option={option}
                            revealed={reveal}
                            chosen={state.chosenId === option.id}
                            display={settings.pinyinDisplay}
                            fontSize={Math.max(
                                MIN_FONT_SIZE,
                                Math.floor((plan?.fontSize ?? 32) * fontAdjust),
                            )}
                            onSelect={() => onSelect(option)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

/**
 * Split text into the units the browser can break between. A Latin word cannot
 * be split across lines, but Chinese text can break between any two characters.
 */
function breakableUnits(text: string): string[] {
    const units: string[] = []

    for (const token of text.split(' ')) {
        if (!token) continue
        if (isHan(token)) units.push(...token)
        else units.push(token)
    }

    return units
}

function PromptText({
    text,
    face,
    display,
    kind,
}: {
    text: string
    face: QuestionFace
    display: PinyinDisplay
    kind: QuestionFace['kind']
}) {
    // The prompt is allowed to grow to fill its box, so it is only capped to stop
    // it becoming silly on a very large screen. This is what the original app was
    // reaching for with `clamp(16px, 50px, 220px)`, which never scaled at all.
    const max = PROMPT_MAX_FONT[kind]

    // A word or a reading stays on one line and shrinks to fit the width. An
    // English gloss is prose and may wrap, or a long one would become unreadable.
    const singleLine = kind !== 'gloss'

    const { ref } = useFitText<HTMLDivElement>(text, { max, min: 14 })

    return (
        <div
            ref={ref}
            className={[
                styles.promptText,
                kind === 'han' ? styles.hanPrompt : '',
                singleLine ? styles.promptSingleLine : '',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <FaceContent face={face} display={display} />
        </div>
    )
}
