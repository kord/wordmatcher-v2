import { describe, expect, it } from 'vitest'
import { buildQuestion } from '../../src/domain/distractors'
import { mulberry32 } from '../../src/domain/rng'
import {
  createSession,
  remainingMs,
  sessionReducer,
  sessionSummary,
  shouldEnd,
  type SessionState,
} from '../../src/domain/session'
import type { Question, SessionConfig, WordEntry } from '../../src/domain/types'
import { makeEntry, makePinyin } from './fixtures'

const NOW = 1_700_000_000_000

const ENTRIES: WordEntry[] = [
  makeEntry({ simp: '爱', id: 'ai', glossShort: 'to love', pinyin: makePinyin('ai4') }),
  makeEntry({ simp: '恨', id: 'hen', glossShort: 'to hate', pinyin: makePinyin('hen4') }),
  makeEntry({ simp: '想', id: 'xiang', glossShort: 'to want', pinyin: makePinyin('xiang3') }),
  makeEntry({ simp: '看', id: 'kan', glossShort: 'to look', pinyin: makePinyin('kan4') }),
]

function questionFor(index: number): Question {
  const entry = ENTRIES[index % ENTRIES.length]
  return buildQuestion({
    entry,
    objective: 'zh-en',
    pool: ENTRIES,
    optionCount: 3,
    charset: 'simp',
    rng: mulberry32(index + 1),
  })
}

function config(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    selection: { kind: 'hsk', level: 1, includeLower: false },
    length: { unit: 'rounds', value: 3 },
    optionCount: 3,
    pinyinDisplay: { style: 'diacritic', toneColours: false },
    characterSet: 'simp',
    ...overrides,
  }
}

function answering(state: SessionState, correct: boolean, now: number): SessionState {
  const target = correct
    ? state.question.options.find((option) => option.isAnswer)
    : state.question.options.find((option) => !option.isAnswer)
  return sessionReducer(state, { type: 'answer', chosenId: target!.entry.id, now })
}

describe('createSession', () => {
  it('starts asking with the first question', () => {
    const state = createSession(config(), questionFor(0), NOW)
    expect(state.phase).toBe('asking')
    expect(state.index).toBe(1)
    expect(state.answeredCount).toBe(0)
    expect(state.endsAt).toBeNull()
  })

  it('sets a deadline for time-based sessions', () => {
    const state = createSession(config({ length: { unit: 'time', value: 300 } }), questionFor(0), NOW)
    expect(state.endsAt).toBe(NOW + 300_000)
    expect(remainingMs(state, NOW + 100_000)).toBe(200_000)
    expect(remainingMs(state, NOW + 999_999)).toBe(0)
  })
})

describe('answering', () => {
  it('records a correct answer and moves to the reveal', () => {
    const state = answering(createSession(config(), questionFor(0), NOW), true, NOW + 1500)

    expect(state.phase).toBe('revealing')
    expect(state.outcome).toBe('correct')
    expect(state.correct).toBe(1)
    expect(state.incorrect).toBe(0)
    expect(state.streak).toBe(1)
    expect(state.longestStreak).toBe(1)
    expect(state.mistakes).toHaveLength(0)
    expect(state.answered[0].msToAnswer).toBe(1500)
  })

  it('records a mistake with both the chosen and the correct text', () => {
    const state = answering(createSession(config(), questionFor(0), NOW), false, NOW + 4000)
    const mistake = state.mistakes[0]

    expect(state.outcome).toBe('incorrect')
    expect(state.incorrect).toBe(1)
    expect(state.streak).toBe(0)
    expect(state.mistakes).toHaveLength(1)
    expect(mistake.entry.id).toBe(state.question.entry.id)
    expect(mistake.correctText).not.toBe(mistake.chosenText)
    expect(mistake.msToAnswer).toBe(4000)
  })

  it('tracks the longest streak across misses', () => {
    let state = createSession(config({ length: { unit: 'rounds', value: 99 } }), questionFor(0), NOW)
    const pattern = [true, true, true, false, true]

    pattern.forEach((correct, i) => {
      state = answering(state, correct, NOW + i * 1000)
      state = sessionReducer(state, { type: 'advance', question: questionFor(i + 1), now: NOW + i * 1000 })
    })

    expect(state.longestStreak).toBe(3)
    expect(state.correct).toBe(4)
    expect(state.incorrect).toBe(1)
    expect(state.mistakes).toHaveLength(1)
  })

  it('ignores a second answer while revealing', () => {
    let state = answering(createSession(config(), questionFor(0), NOW), true, NOW)
    const before = state
    state = sessionReducer(state, { type: 'answer', chosenId: 'anything', now: NOW + 10 })

    expect(state).toBe(before)
    expect(state.answeredCount).toBe(1)
  })

  it('ignores an unknown option id', () => {
    const state = createSession(config(), questionFor(0), NOW)
    expect(sessionReducer(state, { type: 'answer', chosenId: 'nope', now: NOW })).toBe(state)
  })
})

describe('advancing and finishing', () => {
  it('serves the next question until the round limit is reached', () => {
    let state = createSession(config({ length: { unit: 'rounds', value: 2 } }), questionFor(0), NOW)

    state = answering(state, true, NOW)
    expect(shouldEnd(state, NOW)).toBe(false)
    state = sessionReducer(state, { type: 'advance', question: questionFor(1), now: NOW })
    expect(state.phase).toBe('asking')
    expect(state.index).toBe(2)
    expect(state.chosenId).toBeNull()

    state = answering(state, true, NOW + 1000)
    expect(shouldEnd(state, NOW + 1000)).toBe(true)
    state = sessionReducer(state, { type: 'advance', question: questionFor(2), now: NOW + 1000 })
    expect(state.phase).toBe('finished')
    expect(state.finishedAt).toBe(NOW + 1000)
  })

  it('ends a timed session when the deadline passes on advance', () => {
    let state = createSession(config({ length: { unit: 'time', value: 60 } }), questionFor(0), NOW)
    state = answering(state, true, NOW + 10_000)
    state = sessionReducer(state, { type: 'advance', question: questionFor(1), now: NOW + 61_000 })

    expect(state.phase).toBe('finished')
  })

  it('ends a timed session on a tick', () => {
    let state = createSession(config({ length: { unit: 'time', value: 60 } }), questionFor(0), NOW)
    state = sessionReducer(state, { type: 'tick', now: NOW + 10_000 })
    expect(state.phase).toBe('asking')

    state = sessionReducer(state, { type: 'tick', now: NOW + 60_000 })
    expect(state.phase).toBe('finished')
  })

  it('ignores advance while still asking', () => {
    const state = createSession(config(), questionFor(0), NOW)
    expect(sessionReducer(state, { type: 'advance', question: questionFor(1), now: NOW })).toBe(state)
  })

  it('can be finished explicitly and stays finished', () => {
    let state = sessionReducer(createSession(config(), questionFor(0), NOW), { type: 'finish', now: NOW + 500 })
    expect(state.phase).toBe('finished')

    state = sessionReducer(state, { type: 'tick', now: NOW + 900_000 })
    expect(state.phase).toBe('finished')
    expect(state.finishedAt).toBe(NOW + 500)
  })
})

describe('sessionSummary', () => {
  it('summarises the session including mistakes and list names', () => {
    let state = createSession(config({ length: { unit: 'rounds', value: 2 } }), questionFor(0), NOW)
    state = answering(state, false, NOW + 3000)
    state = sessionReducer(state, { type: 'advance', question: questionFor(1), now: NOW + 3000 })
    state = answering(state, true, NOW + 5000)
    state = sessionReducer(state, { type: 'finish', now: NOW + 6000 })

    const summary = sessionSummary(state, ['HSK 1'], NOW + 6000)

    expect(summary.total).toBe(2)
    expect(summary.correct).toBe(1)
    expect(summary.incorrect).toBe(1)
    expect(summary.longestStreak).toBe(1)
    expect(summary.durationMs).toBe(6000)
    expect(summary.mistakes).toHaveLength(1)
    expect(summary.listNames).toEqual(['HSK 1'])
  })

  it('lists each missed word once while counting every wrong answer', () => {
    let state = createSession(config({ length: { unit: 'rounds', value: 3 } }), questionFor(0), NOW)
    const repeated = state.question
    // The same word is missed twice: the original question and its re-ask.
    state = answering(state, false, NOW + 1000)
    state = sessionReducer(state, { type: 'advance', question: repeated, now: NOW + 1000 })
    state = answering(state, false, NOW + 2000)
    state = sessionReducer(state, { type: 'finish', now: NOW + 3000 })

    const summary = sessionSummary(state, ['HSK 1'], NOW + 3000)

    expect(summary.incorrect).toBe(2)
    expect(summary.mistakes).toHaveLength(1)
    expect(summary.mistakes[0].entry.id).toBe(repeated.entry.id)
  })
})
