import type {
  AnsweredQuestion,
  MistakeRecord,
  Outcome,
  Question,
  SessionConfig,
  SessionSummary,
} from './types'

export type SessionPhase = 'asking' | 'revealing' | 'finished'

export interface SessionState {
  config: SessionConfig
  phase: SessionPhase
  question: Question
  /** 1-based position of the current question. */
  index: number
  chosenId: string | null
  outcome: Outcome | null
  answered: AnsweredQuestion[]
  answeredCount: number
  correct: number
  incorrect: number
  streak: number
  longestStreak: number
  mistakes: MistakeRecord[]
  startedAt: number
  questionStartedAt: number
  /** Wall-clock deadline for time-based sessions, otherwise null. */
  endsAt: number | null
  finishedAt: number | null
}

export type SessionAction =
  | { type: 'answer'; chosenId: string; now: number }
  | { type: 'advance'; question: Question; now: number }
  | { type: 'finish'; now: number }
  | { type: 'tick'; now: number }

export function createSession(
  config: SessionConfig,
  firstQuestion: Question,
  now: number,
): SessionState {
  return {
    config,
    phase: 'asking',
    question: firstQuestion,
    index: 1,
    chosenId: null,
    outcome: null,
    answered: [],
    answeredCount: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    longestStreak: 0,
    mistakes: [],
    startedAt: now,
    questionStartedAt: now,
    endsAt: config.length.unit === 'time' ? now + config.length.value * 1000 : null,
    finishedAt: null,
  }
}

/** True once the configured round count or time limit has been reached. */
export function shouldEnd(state: SessionState, now: number): boolean {
  const { length } = state.config
  if (length.unit === 'rounds') return state.answeredCount >= length.value
  return state.endsAt !== null && now >= state.endsAt
}

export function remainingMs(state: SessionState, now: number): number | null {
  if (state.endsAt === null) return null
  return Math.max(0, state.endsAt - now)
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer': {
      if (state.phase !== 'asking') return state

      const answerOption = state.question.options.find((option) => option.isAnswer)
      const chosenOption = state.question.options.find(
        (option) => option.id === action.chosenId,
      )
      if (!answerOption || !chosenOption) return state

      const outcome: Outcome = chosenOption.isAnswer ? 'correct' : 'incorrect'
      const msToAnswer = Math.max(0, action.now - state.questionStartedAt)
      const streak = outcome === 'correct' ? state.streak + 1 : 0

      const mistakes = [...state.mistakes]
      if (outcome === 'incorrect') {
        mistakes.push({
          entry: state.question.entry,
          objective: state.question.objective,
          chosenText: chosenOption.face.text,
          correctText: answerOption.face.text,
          msToAnswer,
        })
      }

      return {
        ...state,
        phase: 'revealing',
        chosenId: action.chosenId,
        outcome,
        answered: [...state.answered, { question: state.question, chosenId: action.chosenId, outcome, msToAnswer }],
        answeredCount: state.answeredCount + 1,
        correct: state.correct + (outcome === 'correct' ? 1 : 0),
        incorrect: state.incorrect + (outcome === 'incorrect' ? 1 : 0),
        streak,
        longestStreak: Math.max(state.longestStreak, streak),
        mistakes,
      }
    }

    case 'advance': {
      if (state.phase !== 'revealing') return state
      if (shouldEnd(state, action.now)) {
        return { ...state, phase: 'finished', finishedAt: action.now }
      }
      return {
        ...state,
        phase: 'asking',
        question: action.question,
        index: state.index + 1,
        chosenId: null,
        outcome: null,
        questionStartedAt: action.now,
      }
    }

    case 'finish': {
      if (state.phase === 'finished') return state
      return { ...state, phase: 'finished', finishedAt: action.now }
    }

    case 'tick': {
      if (state.phase === 'finished') return state
      if (state.endsAt !== null && action.now >= state.endsAt) {
        return { ...state, phase: 'finished', finishedAt: action.now }
      }
      return state
    }
  }
}

export function sessionSummary(
  state: SessionState,
  listNames: string[],
  now: number,
): SessionSummary {
  const finishedAt = state.finishedAt ?? now
  return {
    total: state.answeredCount,
    correct: state.correct,
    incorrect: state.incorrect,
    longestStreak: state.longestStreak,
    durationMs: Math.max(0, finishedAt - state.startedAt),
    mistakes: dedupeMistakes(state.mistakes),
    listNames,
  }
}

/**
 * One review entry per word. A word missed twice (for example the original
 * question and its in-session re-ask) should be reviewed once, while the
 * `incorrect` tally still counts every wrong answer.
 */
function dedupeMistakes(mistakes: MistakeRecord[]): MistakeRecord[] {
  const byWord = new Map<string, MistakeRecord>()

  for (const mistake of mistakes) {
    if (!byWord.has(mistake.entry.id)) byWord.set(mistake.entry.id, mistake)
  }

  return [...byWord.values()]
}
