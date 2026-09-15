import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { loadManifest } from '../../content/listLoader'
import { resolvePool, type ResolvedPool } from '../../content/wordPool'
import { REASK_DELAY_QUESTIONS, RECENT_EXCLUSION } from '../../domain/constants'
import { buildQuestion } from '../../domain/distractors'
import { chooseObjective } from '../../domain/objectives'
import { mulberry32 } from '../../domain/rng'
import { applyOutcome, createProgress, pickNextWord } from '../../domain/scheduler'
import {
    createSession,
    sessionReducer,
    sessionSummary,
    shouldEnd,
    type SessionState,
} from '../../domain/session'
import type {
    ProgressRecord,
    Question,
    SessionConfig,
    SessionSummary,
    WordEntry,
} from '../../domain/types'
import { loadProgress, saveProgress } from '../../storage/progressRepo'
import { saveSession } from '../../storage/sessionRepo'
import { useSettings } from '../../ui/hooks/useSettings'

export type SessionPhase = 'idle' | 'loading' | 'playing' | 'finished'

interface SessionContextValue {
    phase: SessionPhase
    state: SessionState | null
    summary: SessionSummary | null
    error: string | null
    listNames: string[]
    poolSize: number
    /** Bumped when persisted progress changes, so read-only views can refresh. */
    progressRevision: number
    start: () => Promise<boolean>
    practiseMistakes: () => Promise<boolean>
    answer: (optionId: string) => void
    advance: () => void
    quit: () => void
    clearSummary: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
    const { settings } = useSettings()

    const [phase, setPhase] = useState<SessionPhase>('idle')
    const [state, setState] = useState<SessionState | null>(null)
    const [summary, setSummary] = useState<SessionSummary | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [listNames, setListNames] = useState<string[]>([])
    const [progressRevision, setProgressRevision] = useState(0)

    const poolRef = useRef<ResolvedPool | null>(null)
    const configRef = useRef<SessionConfig | null>(null)
    const progressRef = useRef<Map<string, ProgressRecord>>(new Map())
    const recentRef = useRef<string[]>([])
    const reaskRef = useRef<{ wordId: string; dueAtIndex: number }[]>([])
    const nextQuestionRef = useRef<Question | null>(null)
    const listNamesRef = useRef<string[]>([])
    const rngRef = useRef(mulberry32(1))
    // Kept in step with `state` so callbacks never read a stale render value.
    const stateRef = useRef<SessionState | null>(null)

    const applyState = useCallback((next: SessionState) => {
        stateRef.current = next
        setState(next)
    }, [])

    /**
     * Build the question for 1-based position `index`, preferring a word the
     * player already missed this session so misses come back around.
     */
    const generateQuestion = useCallback((index: number, now: number): Question | null => {
        const pool = poolRef.current
        const config = configRef.current
        if (!pool || !config) return null

        // Distractors may come from a wider set than the words being asked.
        const distractorPool = pool.distractorPool ?? pool.entries
        if (distractorPool.length < 2) return null

        let entry: WordEntry | undefined

        const dueReask = reaskRef.current.find((item) => item.dueAtIndex <= index)
        if (dueReask) {
            reaskRef.current = reaskRef.current.filter((item) => item !== dueReask)
            entry = pool.entries.find((candidate) => candidate.id === dueReask.wordId)
        }

        entry ??= pickNextWord(pool.entries, progressRef.current, recentRef.current, rngRef.current, now)
        if (!entry) return null

        recentRef.current = [...recentRef.current, entry.id].slice(-RECENT_EXCLUSION)
        nextQuestionRef.current = null

        return buildQuestion({
            entry,
            objective: chooseObjective(rngRef.current, entry, config.objectives),
            pool: distractorPool,
            optionCount: config.optionCount,
            charset: config.characterSet,
            scheme: config.romanization,
            rng: rngRef.current,
        })
    }, [])

    const finishSession = useCallback(
        (current: SessionState, now: number) => {
            const finished = sessionReducer(current, { type: 'finish', now })
            applyState(finished)
            const result = sessionSummary(finished, listNamesRef.current, now)
            setSummary(result)
            setPhase('finished')
            void saveSession({
                id: `${finished.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
                language: finished.config.language,
                startedAt: finished.startedAt,
                finishedAt: now,
                summary: result,
            })
        },
        [applyState],
    )

    const beginSession = useCallback(
        (
            config: SessionConfig,
            pool: ResolvedPool,
            names: string[],
            progress: Map<string, ProgressRecord>,
        ) => {
            poolRef.current = pool
            configRef.current = config
            progressRef.current = progress
            listNamesRef.current = names
            recentRef.current = []
            reaskRef.current = []
            nextQuestionRef.current = null
            rngRef.current = mulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)

            const now = Date.now()
            const first = generateQuestion(1, now)
            if (!first) throw new Error('Could not build a question from that list.')

            setListNames(names)
            applyState(createSession(config, first, now))
            setPhase('playing')
        },
        [applyState, generateQuestion],
    )

    const configFromSettings = useCallback(
        (): SessionConfig => {
            const language = settings.byLanguage[settings.language]
            return {
                // Captured here and never re-read, which is what fixes the variety for the
                // whole session: changing the setting mid-session cannot reach it.
                language: settings.language,
                selection: language.selection,
                length: settings.length,
                optionCount: settings.optionCount,
                pinyinDisplay: settings.pinyinDisplay,
                characterSet: language.characterSet,
                romanization: language.romanization,
                objectives: language.objectives,
            }
        },
        [settings],
    )

    const start = useCallback(async () => {
        setError(null)
        setSummary(null)
        setPhase('loading')

        try {
            const config = configFromSettings()
            const manifest = await loadManifest()
            const pool = await resolvePool(config.selection, manifest, config.language)
            if (pool.entries.length < 2) {
                throw new Error('That word list is too small to play. Pick another list.')
            }
            const progress = await loadProgress(config.language)
            beginSession(config, pool, pool.listNames, progress)
            return true
        } catch (cause) {
            setPhase('idle')
            setError(cause instanceof Error ? cause.message : 'Could not start the session.')
            return false
        }
    }, [beginSession, configFromSettings])

    const practiseMistakes = useCallback(async () => {
        const mistakes = summary?.mistakes ?? []
        if (mistakes.length === 0) return false

        setError(null)
        setPhase('loading')

        try {
            const unique = new Map<string, WordEntry>()
            for (const mistake of mistakes) unique.set(mistake.entry.id, mistake.entry)
            const entries = [...unique.values()]

            const previous = configFromSettings()
            const config: SessionConfig = {
                ...previous,
                length: { unit: 'rounds', value: Math.max(entries.length, 4) },
            }

            // Distractors come from the list the player is studying, so even a single
            // missed word can be drilled as a real multiple-choice question.
            let distractorPool = entries
            try {
                const manifest = await loadManifest()
                const full = await resolvePool(config.selection, manifest, config.language)
                if (full.entries.length >= 2) distractorPool = full.entries
            } catch {
                // Offline with only the reviewed words available: use them.
            }

            const progress = await loadProgress(config.language)
            beginSession(
                config,
                { entries, listNames: ['Mistake review'], distractorPool },
                ['Mistake review'],
                progress,
            )
            return true
        } catch (cause) {
            setPhase('idle')
            setError(cause instanceof Error ? cause.message : 'Could not start the review session.')
            return false
        }
    }, [beginSession, configFromSettings, summary])

    const answer = useCallback(
        (optionId: string) => {
            const current = stateRef.current
            if (!current || current.phase !== 'asking') return

            const chosen = current.question.options.find((option) => option.id === optionId)
            if (!chosen) return

            const now = Date.now()
            const next = sessionReducer(current, { type: 'answer', chosenId: optionId, now })
            applyState(next)

            const wordId = current.question.entry.id
            const record =
                progressRef.current.get(wordId) ??
                createProgress(wordId, current.config.language, now)
            const outcome = chosen.isAnswer ? 'correct' : 'incorrect'
            const msToAnswer = next.answered[next.answered.length - 1]?.msToAnswer ?? 0
            const updated = applyOutcome(record, outcome, now, msToAnswer)
            progressRef.current.set(wordId, updated)
            void saveProgress([updated]).then(() => setProgressRevision((value) => value + 1))

            // A missed word comes back once, later in the same session.
            if (outcome === 'incorrect' && !reaskRef.current.some((item) => item.wordId === wordId)) {
                reaskRef.current.push({ wordId, dueAtIndex: current.index + REASK_DELAY_QUESTIONS })
            }

            // Queue the next question while the player reads the reveal.
            nextQuestionRef.current = generateQuestion(current.index + 1, now)
        },
        [applyState, generateQuestion],
    )

    const advance = useCallback(() => {
        const current = stateRef.current
        if (!current || current.phase !== 'revealing') return

        const now = Date.now()

        // The round or time limit is only reached once the answer has been read, so
        // a session always ends after a reveal rather than mid-question.
        if (shouldEnd(current, now)) {
            finishSession(current, now)
            return
        }

        const next = nextQuestionRef.current ?? generateQuestion(current.index + 1, now)
        if (!next) {
            finishSession(current, now)
            return
        }

        applyState(sessionReducer(current, { type: 'advance', question: next, now }))
    }, [applyState, finishSession, generateQuestion])

    const quit = useCallback(() => {
        const current = stateRef.current
        if (!current || current.answeredCount === 0) {
            setPhase('idle')
            return
        }
        finishSession(current, Date.now())
    }, [finishSession])

    const clearSummary = useCallback(() => {
        setSummary(null)
        setPhase('idle')
    }, [])

    // End a timed session even if the player is mid-reveal.
    const endsAt = state?.endsAt ?? null
    useEffect(() => {
        if (phase !== 'playing' || endsAt === null) return

        const timer = window.setInterval(() => {
            const current = stateRef.current
            if (!current || current.endsAt === null) return
            if (Date.now() >= current.endsAt) finishSession(current, Date.now())
        }, 500)

        return () => window.clearInterval(timer)
    }, [phase, endsAt, finishSession])

    const value = useMemo<SessionContextValue>(
        () => ({
            phase,
            state,
            summary,
            error,
            listNames,
            poolSize: poolRef.current?.entries.length ?? 0,
            progressRevision,
            start,
            practiseMistakes,
            answer,
            advance,
            quit,
            clearSummary,
        }),
        [
            phase,
            state,
            summary,
            error,
            listNames,
            progressRevision,
            start,
            practiseMistakes,
            answer,
            advance,
            quit,
            clearSummary,
        ],
    )

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
    const value = useContext(SessionContext)
    if (!value) throw new Error('useSession must be used inside a SessionProvider')
    return value
}
